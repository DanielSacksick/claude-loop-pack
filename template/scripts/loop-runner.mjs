#!/usr/bin/env node
// Runs ONE tour of the loop as a headless `claude -p` process, measures it, records it.
// Usage: node scripts/loop-runner.mjs [--dry-run]
// Normally started by scripts/loop-tick.mjs (launchd/cron). Safe to run by hand.

import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStatus, validateStatus, spentUsd } from '../.claude/hooks/lib/status.mjs';
import { loadConfig } from './lib/config.mjs';
import * as files from './lib/loop-files.mjs';
import { appendTour, tourFromResult } from './lib/ledger.mjs';
import { notify } from './lib/notify.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
const cfg = loadConfig(ROOT);
const git = (...args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const log = (msg) => {
  files.appendLog(ROOT, 'runner.log', msg);
  console.log(msg);
};

// Returns null when a tour may start, otherwise the reason it must not.
function preflight() {
  if (fs.existsSync(path.join(ROOT, 'STOP'))) return 'STOP file present';
  let status;
  try {
    status = loadStatus(ROOT);
  } catch (err) {
    return `cannot read sprint-status.yaml: ${err.message}`;
  }
  const errors = validateStatus(status.data, status.text);
  if (errors.length) return `sprint-status.yaml invalid: ${errors.join('; ')}`;
  const loop = status.data.loop;
  // A dry run during setup (readiness gate) checks everything except the start switch.
  const allowed = DRY ? ['running', 'setup'] : ['running'];
  if (!allowed.includes(loop.status)) return `loop.status is ${loop.status}`;
  const left = status.data.budget.total_usd - spentUsd(status.data);
  if (left <= 0.5) return `global budget spent (${spentUsd(status.data).toFixed(2)} USD)`;
  return null;
}

function syncControlBranch() {
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (branch !== cfg.controlBranch) throw new Error(`root checkout is on "${branch}", expected ${cfg.controlBranch}`);
  git('fetch', 'origin', '--prune');
  try {
    git('merge', '--no-edit', 'origin/main');
  } catch (err) {
    git('merge', '--abort');
    throw new Error(`cannot merge origin/main into ${cfg.controlBranch}: ${err.message.split('\n')[0]}`);
  }
}

function tourBudget(data) {
  const left = data.budget.total_usd - spentUsd(data);
  return Math.max(0.5, Math.min(data.budget.per_tour_usd, left));
}

function prompt(n) {
  return [
    `Tour de boucle n°${n}. Invoque le skill loop-tour et suis-le à la lettre.`,
    'Tu es en mode non interactif : aucun humain ne répondra. Ne pose aucune question ;',
    'si une décision humaine est nécessaire, passe loop.status à blocked avec blocked_reason précis, puis termine le tour.',
  ].join(' ');
}

function runClaude(n, budgetUsd) {
  const args = ['-p', prompt(n), '--agent', 'orchestrator', '--output-format', 'json',
    '--permission-mode', 'dontAsk', '--max-budget-usd', String(budgetUsd), '--max-turns', String(cfg.maxTurns)];
  if (cfg.model) args.push('--model', cfg.model); // otherwise the orchestrator agent's own model applies
  if (cfg.lean) args.push('--setting-sources', 'project,local', '--strict-mcp-config');
  return new Promise((resolve) => {
    const child = spawn(cfg.claudeBin, args, {
      cwd: ROOT,
      env: { ...process.env, LOOP_TOUR: String(n), CLAUDE_PROJECT_DIR: ROOT },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true, // own process group, so the timeout kills subagent processes too
    });
    files.writeHeartbeat(ROOT, { phase: 'start', tour: n, pid: process.pid, claude_pgid: child.pid });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch { /* already gone */ }
    }, cfg.tourTimeoutMin * 60 * 1000);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, out, err });
    });
  });
}

function parseResult(raw) {
  try {
    return JSON.parse(raw.trim().split('\n').pop());
  } catch {
    return null;
  }
}

function commitAndPush(n) {
  const tracked = ['docs', 'MAP.md', 'CLAUDE.md'].filter((p) => fs.existsSync(path.join(ROOT, p)));
  git('add', '-A', '--', ...tracked);
  const staged = git('diff', '--cached', '--name-only');
  if (staged) git('commit', '-m', `chore(loop): tour ${n} state and ledger`);
  git('push', 'origin', cfg.controlBranch);
}

async function main() {
  const lock = files.acquireLock(ROOT, { kind: 'tour' });
  if (!lock.ok) return log(`skip: tour already running (pid ${lock.holder?.pid})`);
  try {
    const reason = preflight();
    if (reason) {
      if (/invalid|cannot read|budget/.test(reason)) notify(ROOT, 'Loop needs you', reason);
      return log(`no tour: ${reason}`);
    }
    syncControlBranch();
    const { data } = loadStatus(ROOT);
    const n = (data.tours || []).reduce((m, t) => Math.max(m, t.n || 0), 0) + 1;
    const budget = tourBudget(data);
    if (DRY) return log(`dry-run OK: would start tour ${n} with --max-budget-usd ${budget} --agent orchestrator`);

    const start = files.nowIso();
    files.writeHeartbeat(ROOT, { phase: 'start', tour: n, pid: process.pid });
    log(`tour ${n} start (budget ${budget} USD)`);
    const res = await runClaude(n, budget);
    const end = files.nowIso();
    fs.writeFileSync(path.join(files.loopDir(ROOT), 'logs', `tour-${n}.json`), res.out);
    fs.writeFileSync(path.join(files.loopDir(ROOT), 'logs', `tour-${n}.stderr.log`), res.err);
    if (/not been trusted/.test(res.err)) notify(ROOT, 'Loop: workspace not trusted', 'allowlist ignored; run claude here once and accept the trust dialog');

    const result = parseResult(res.out);
    let exit = 'ok';
    if (res.signal) exit = 'timeout';
    else if (!result) exit = 'error';
    else if (result.subtype === 'error_max_budget_usd' || /budget/i.test(result.subtype || '')) exit = 'budget';
    else if (result.is_error) exit = 'error';

    appendTour(ROOT, tourFromResult(result, { n, start, end, exit }));
    commitAndPush(n);
    files.writeHeartbeat(ROOT, { phase: 'end', tour: n, exit });
    files.setNextRun(ROOT, new Date(Date.now() + cfg.intervalMin * 60 * 1000));
    log(`tour ${n} end: ${exit}, ${result?.total_cost_usd ?? '?'} USD, ${result?.num_turns ?? '?'} turns`);

    const after = loadStatus(ROOT).data.loop;
    if (['blocked', 'done'].includes(after.status) || exit !== 'ok') {
      notify(ROOT, `Loop ${after.status}`, after.blocked_reason || `tour ${n} exit=${exit}`);
    }
  } catch (err) {
    log(`runner error: ${err.message}`);
    if (!DRY) {
      notify(ROOT, 'Loop runner error', err.message);
      files.setNextRun(ROOT, new Date(Date.now() + cfg.intervalMin * 60 * 1000)); // back off before retrying
    }
    process.exitCode = 1;
  } finally {
    files.releaseLock(ROOT);
  }
}

main();
