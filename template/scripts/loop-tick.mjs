#!/usr/bin/env node
// Called every 5 minutes by launchd/cron. Starts a tour only when it is due:
// no tour running, no STOP, and now >= next_run_at (= end of previous tour + LOOP_INTERVAL_MIN).
// Usage: node scripts/loop-tick.mjs [--dry-run]

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as files from './lib/loop-files.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const passthrough = process.argv.slice(2);

function due() {
  if (fs.existsSync(path.join(ROOT, 'STOP'))) return 'STOP file present';
  const lock = files.readLock(ROOT);
  if (lock && files.isAlive(lock.pid)) return `tour running (pid ${lock.pid})`;
  const next = files.readNextRun(ROOT);
  if (next && next > new Date()) return `next tour at ${next.toISOString()}`;
  return null;
}

const reason = due();
if (reason) {
  console.log(`tick: not due (${reason})`);
} else {
  // LOOP_TRIGGER=scheduler is set by the launchd/cron entry; anything else is a manual start.
  files.appendLog(ROOT, 'tick.log', `starting runner trigger=${process.env.LOOP_TRIGGER || 'manual'}${passthrough.length ? ' ' + passthrough.join(' ') : ''}`);
  // Detached so launchd's job ends now while the tour keeps running.
  const child = spawn(process.execPath, [path.join(ROOT, 'scripts/loop-runner.mjs'), ...passthrough], {
    cwd: ROOT,
    detached: !passthrough.includes('--dry-run'),
    stdio: passthrough.includes('--dry-run') ? 'inherit' : 'ignore',
  });
  if (!passthrough.includes('--dry-run')) child.unref();
}
