#!/usr/bin/env node
// Starts (or resumes) the loop: loop.status -> running, removes STOP, commits on loop/control,
// pushes, and fires the first tour right away. Pause with: touch STOP  (or loop.status: paused).
// Usage: node scripts/loop-start.mjs [--no-tour]

import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { statusPath } from '../.claude/hooks/lib/status.mjs';
import { setNextRun } from './lib/loop-files.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'loop/control') {
  console.error('the project root must be on loop/control (see docs/orchestrate.md § 2)');
  process.exit(1);
}
const file = statusPath(ROOT);
const before = fs.readFileSync(file, 'utf8');
const after = before
  .replace(/^(  status: )(setup|paused|blocked)\b/m, '$1running')
  .replace(/^(  blocked_reason: ).*$/m, '$1null')
  .replace(/^(  no_progress_streak: ).*$/m, '$10')
  .replace(/^updated: .*$/m, `updated: "${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}"`);
fs.writeFileSync(file, after);
fs.rmSync(path.join(ROOT, 'STOP'), { force: true });
setNextRun(ROOT, null);
git('add', file);
if (git('diff', '--cached', '--name-only')) git('commit', '-m', 'chore(loop): start');
git('push', 'origin', 'loop/control');
console.log('loop.status = running');
if (!process.argv.includes('--no-tour')) {
  spawn(process.execPath, [path.join(ROOT, 'scripts/loop-tick.mjs')], { cwd: ROOT, stdio: 'inherit' });
}
