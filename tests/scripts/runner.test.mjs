// End-to-end test of the relaunch machinery with a fake `claude` binary.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TEMPLATE = path.resolve(import.meta.dirname, '../../template');

function sh(cwd, cmd, args, env = {}) {
  try { return execFileSync(cmd, args, { cwd, encoding: 'utf8', env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { e.message += `\n${e.stdout}${e.stderr}`; throw e; }
}

function project({ status = 'running', fakeCost = 1.5 } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'loop-run-'));
  const origin = path.join(base, 'origin.git');
  const root = path.join(base, 'app');
  sh(base, 'git', ['init', '-q', '--bare', '-b', 'main', origin]);
  fs.cpSync(TEMPLATE, root, { recursive: true });
  const statusFile = path.join(root, 'docs/sprint-status.yaml');
  fs.writeFileSync(statusFile, fs.readFileSync(statusFile, 'utf8')
    .replace('status: setup', `status: ${status}`).replace('"{{NOW}}"', '"2026-01-01T00:00:00Z"'));
  fs.writeFileSync(path.join(root, '.gitignore'), '.loop/\n');
  const fake = path.join(base, 'fake-claude.sh');
  fs.writeFileSync(fake, `#!/bin/sh
echo "args: $*" > "$CLAUDE_PROJECT_DIR/.loop/fake-args"
mkdir -p "$CLAUDE_PROJECT_DIR/docs/journal" && echo "tour $LOOP_TOUR" > "$CLAUDE_PROJECT_DIR/docs/journal/tour-$LOOP_TOUR.md"
echo '{"type":"result","subtype":"success","is_error":false,"num_turns":12,"session_id":"s-1","total_cost_usd":${fakeCost},"usage":{"input_tokens":100,"output_tokens":2000,"cache_read_input_tokens":5000,"cache_creation_input_tokens":300}}'
`, { mode: 0o755 });
  for (const args of [['init', '-q', '-b', 'main'], ['config', 'user.email', 't@t'], ['config', 'user.name', 't'],
    ['add', '.'], ['commit', '-qm', 'init'], ['remote', 'add', 'origin', origin], ['push', '-q', 'origin', 'main'],
    ['checkout', '-q', '-b', 'loop/control'], ['push', '-q', 'origin', 'loop/control']]) sh(root, 'git', args);
  return { root, origin, env: { CLAUDE_BIN: fake, LOOP_NOTIFY_CMD: 'true' } };
}

const node = (p, script, args = []) => sh(p.root, 'node', [`scripts/${script}`, ...args], p.env);

test('runner: one measured tour is recorded, committed on loop/control and pushed', () => {
  const p = project();
  node(p, 'loop-runner.mjs');
  const status = fs.readFileSync(path.join(p.root, 'docs/sprint-status.yaml'), 'utf8');
  assert.match(status, /- \{n: 1, .*cost_usd: 1\.5, .*output_tokens: 2000, .*turns: 12, exit: "ok", session: "s-1"\}/);
  assert.match(fs.readFileSync(path.join(p.root, '.loop/fake-args'), 'utf8'), /--agent orchestrator --output-format json --permission-mode dontAsk --max-budget-usd 8 --max-turns/);
  assert.equal(sh(p.root, 'git', ['log', '-1', '--format=%s', 'origin/loop/control']).trim(), 'chore(loop): tour 1 state and ledger');
  assert.ok(fs.existsSync(path.join(p.root, 'docs/journal/tour-1.md')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(p.root, '.loop/heartbeat.json'))).phase, 'end');
  assert.match(node(p, 'validate-status.mjs'), /^valid .*spent=1\.50\/50/);
  node(p, 'loop-runner.mjs'); // runner does not gate on next_run_at; the tick does
  assert.match(fs.readFileSync(path.join(p.root, 'docs/sprint-status.yaml'), 'utf8'), /\{n: 2,/);
});

test('tick: waits for next_run_at, skips on STOP', () => {
  const p = project();
  node(p, 'loop-runner.mjs');
  assert.match(node(p, 'loop-tick.mjs'), /not due \(next tour at/);
  fs.writeFileSync(path.join(p.root, '.loop/next_run_at'), new Date(Date.now() - 1000).toISOString());
  assert.match(node(p, 'loop-tick.mjs', ['--dry-run']), /dry-run OK: would start tour 2/);
  fs.writeFileSync(path.join(p.root, 'STOP'), '');
  assert.match(node(p, 'loop-tick.mjs'), /STOP file present/);
});

test('runner refuses to start when not running, over budget, or on the wrong branch', () => {
  assert.match(node(project({ status: 'paused' }), 'loop-runner.mjs'), /no tour: loop.status is paused/);
  const rich = project({ fakeCost: 49.8 });
  node(rich, 'loop-runner.mjs');
  assert.match(node(rich, 'loop-runner.mjs'), /no tour: global budget spent/);
  const wrong = project();
  sh(wrong.root, 'git', ['checkout', '-q', 'main']);
  assert.throws(() => node(wrong, 'loop-runner.mjs'), /expected loop\/control/);
});

test('watchdog: fine when fresh, recovers when stale', () => {
  const p = project();
  node(p, 'loop-runner.mjs');
  assert.match(node(p, 'loop-watchdog.mjs'), /fine \(heartbeat 0 min ago\)/);
  const hb = path.join(p.root, '.loop/heartbeat.json');
  fs.writeFileSync(hb, JSON.stringify({ ts: new Date(Date.now() - 3 * 3600e3).toISOString(), phase: 'start' }));
  assert.match(node(p, 'loop-watchdog.mjs', ['--dry-run']), /would recover \(no heartbeat for 180 min\)/);
});

test('cost report reads the measured ledger', () => {
  const p = project();
  node(p, 'loop-runner.mjs');
  node(p, 'loop-runner.mjs');
  const r = JSON.parse(node(p, 'cost-report.mjs', ['--json']));
  assert.equal(r.tours, 2);
  assert.equal(r.cost_usd, 3);
  assert.equal(r.tokens.output, 4000);
});

test('a failing dry run does not schedule anything', () => {
  const p = project();
  sh(p.root, 'git', ['checkout', '-q', 'main']);
  assert.throws(() => node(p, 'loop-runner.mjs', ['--dry-run']));
  assert.equal(fs.existsSync(path.join(p.root, '.loop/next_run_at')), false);
});
