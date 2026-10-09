#!/usr/bin/env node
// HUMAN step of setup-loop (step 6): puts the framed project on GitHub, ready for the loop.
// - first push: commits the framing docs on main (the only sanctioned direct commit), pushes it
// - existing repo with main: opens a PR "chore: frame the project for the loop" instead
// - protects main (PR required, CI required, no force push) when the GitHub plan allows it
// - creates loop/control from main and checks it out
// Usage: node scripts/bootstrap-repo.mjs --repo owner/name [--create] [--public]

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const repo = opt('--repo');
if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
  console.error('usage: node scripts/bootstrap-repo.mjs --repo owner/name [--create] [--public]');
  process.exit(1);
}

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
const tryRun = (cmd, args) => {
  try {
    return run(cmd, args);
  } catch {
    return null;
  }
};
const step = (msg) => console.log(`• ${msg}`);

function ensureRepo() {
  if (!fs.existsSync(path.join(ROOT, '.git'))) {
    run('git', ['init', '-b', 'main']);
    step('git init (main)');
  }
  if (argv.includes('--create') && !tryRun('gh', ['repo', 'view', repo])) {
    run('gh', ['repo', 'create', repo, argv.includes('--public') ? '--public' : '--private']);
    step(`GitHub repo ${repo} created`);
  }
  if (!tryRun('git', ['remote', 'get-url', 'origin'])) {
    run('git', ['remote', 'add', 'origin', `https://github.com/${repo}.git`]);
  }
  tryRun('git', ['fetch', 'origin']);
}

function publishFraming() {
  const remoteMain = tryRun('git', ['rev-parse', '--verify', 'origin/main']);
  if (!remoteMain) {
    if (!tryRun('git', ['rev-parse', '--verify', 'HEAD'])) run('git', ['checkout', '-B', 'main']);
    run('git', ['add', '-A']);
    if (run('git', ['diff', '--cached', '--name-only'])) run('git', ['commit', '-m', 'chore: frame the project for the loop']);
    run('git', ['push', '-u', 'origin', 'main']);
    step('framing committed and pushed to main (first push)');
    return;
  }
  run('git', ['checkout', '-B', 'loop/bootstrap']);
  run('git', ['add', '-A']);
  if (run('git', ['diff', '--cached', '--name-only'])) run('git', ['commit', '-m', 'chore: frame the project for the loop']);
  run('git', ['push', '-u', 'origin', 'loop/bootstrap']);
  const url = run('gh', ['pr', 'create', '--base', 'main', '--title', 'chore: frame the project for the loop',
    '--body', 'Cadrage (PRD, design, maquette, epics, sprint 1, harness). Généré par setup-loop.']);
  step(`existing main: framing PR opened ${url} — merge it, then re-run this script`);
  process.exit(0);
}

function protectMain() {
  const body = JSON.stringify({
    required_status_checks: { strict: false, contexts: ['verify'] },
    enforce_admins: true,
    required_pull_request_reviews: null, // a solo account cannot approve its own PRs; reviews are LOOP-REVIEW comments
    restrictions: null,
    allow_force_pushes: false,
    allow_deletions: false,
  });
  try {
    run('gh', ['api', '-X', 'PUT', `repos/${repo}/branches/main/protection`, '--input', '-'], { input: body, stdio: ['pipe', 'pipe', 'pipe'] });
    step('main protected (PR + CI "verify" required, no force push, no deletion)');
  } catch (err) {
    const msg = String(err.stderr || err.message);
    console.warn(`! branch protection unavailable (${/403|upgrade|Pro/i.test(msg) ? 'private repo on a free plan' : msg.split('\n')[0]}).`);
    console.warn('  The local hooks still block pushes to main. Make the repo public or upgrade to enable server-side protection.');
  }
}

function controlBranch() {
  run('git', ['checkout', '-B', 'loop/control', 'origin/main']);
  run('git', ['push', '-u', 'origin', 'loop/control']);
  step('loop/control created from main and checked out');
}

ensureRepo();
publishFraming();
protectMain();
controlBranch();
console.log('\nNext: node scripts/readiness.mjs');
