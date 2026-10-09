#!/usr/bin/env node
// Called every 15 minutes by launchd/cron. If the loop should be running but no heartbeat
// was written for LOOP_WATCHDOG_STALE_MIN (default 120), it kills a stuck tour, frees the lock,
// clears the wait, notifies the human, and starts a tour right away.
// Usage: node scripts/loop-watchdog.mjs [--dry-run]

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStatus } from '../.claude/hooks/lib/status.mjs';
import { loadConfig } from './lib/config.mjs';
import * as files from './lib/loop-files.mjs';
import { notify } from './lib/notify.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
const cfg = loadConfig(ROOT);

function minutesSince(iso) {
  return iso ? (Date.now() - new Date(iso).getTime()) / 60000 : Infinity;
}

function check() {
  if (fs.existsSync(path.join(ROOT, 'STOP'))) return { ok: true, why: 'STOP present' };
  let status;
  try {
    status = loadStatus(ROOT).data.loop.status;
  } catch {
    return { ok: true, why: 'no readable status (runner will report it)' };
  }
  if (status !== 'running') return { ok: true, why: `loop ${status}` };
  const hb = files.readHeartbeat(ROOT);
  const age = minutesSince(hb?.ts);
  if (age < cfg.staleMin) return { ok: true, why: `heartbeat ${Math.round(age)} min ago` };
  return { ok: false, why: `no heartbeat for ${Number.isFinite(age) ? Math.round(age) : '∞'} min`, hb };
}

const result = check();
if (result.ok) {
  console.log(`watchdog: fine (${result.why})`);
} else if (DRY) {
  console.log(`watchdog dry-run: would recover (${result.why})`);
} else {
  const lock = files.readLock(ROOT);
  const kill = (pid, group) => {
    try { process.kill(group ? -pid : pid, 'SIGTERM'); } catch { /* already gone */ }
  };
  if (result.hb?.claude_pgid) kill(result.hb.claude_pgid, true); // claude + its subagents
  if (lock && files.isAlive(lock.pid)) kill(lock.pid, false);
  files.forceReleaseLock(ROOT);
  files.setNextRun(ROOT, null);
  files.appendLog(ROOT, 'watchdog.log', `recovering: ${result.why}; lock was ${JSON.stringify(lock)}`);
  notify(ROOT, 'Loop watchdog', `${result.why}; restarting a tour`);
  spawn(process.execPath, [path.join(ROOT, 'scripts/loop-runner.mjs')], {
    cwd: ROOT, detached: true, stdio: 'ignore', env: { ...process.env, LOOP_TRIGGER: 'watchdog' },
  }).unref();
}
