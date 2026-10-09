// Machine-local runtime files under .loop/ (gitignored): lock, heartbeat, next run, logs.
// Project state lives in docs/sprint-status.yaml; this folder only holds what is per-machine.

import fs from 'node:fs';
import path from 'node:path';

export function loopDir(root) {
  const dir = path.join(root, '.loop');
  fs.mkdirSync(path.join(dir, 'logs'), { recursive: true });
  return dir;
}

const file = (root, name) => path.join(loopDir(root), name);
const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

export function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Atomic lock: O_EXCL create. A lock whose pid is dead is stale and reclaimed.
export function acquireLock(root, meta = {}) {
  const p = file(root, 'runner.lock');
  const existing = readJson(p);
  if (existing && isAlive(existing.pid)) return { ok: false, holder: existing };
  if (existing) fs.rmSync(p, { force: true });
  try {
    fs.writeFileSync(p, JSON.stringify({ pid: process.pid, since: nowIso(), ...meta }), { flag: 'wx' });
    return { ok: true };
  } catch {
    return { ok: false, holder: readJson(p) };
  }
}

export function readLock(root) {
  return readJson(file(root, 'runner.lock'));
}

export function releaseLock(root) {
  const lock = readLock(root);
  if (lock && lock.pid === process.pid) fs.rmSync(file(root, 'runner.lock'), { force: true });
}

export function forceReleaseLock(root) {
  fs.rmSync(file(root, 'runner.lock'), { force: true });
}

export function writeHeartbeat(root, data) {
  fs.writeFileSync(file(root, 'heartbeat.json'), JSON.stringify({ ts: nowIso(), ...data }, null, 2));
}

export function readHeartbeat(root) {
  return readJson(file(root, 'heartbeat.json'));
}

export function setNextRun(root, date) {
  fs.writeFileSync(file(root, 'next_run_at'), date ? date.toISOString() : '');
}

export function readNextRun(root) {
  try {
    const raw = fs.readFileSync(file(root, 'next_run_at'), 'utf8').trim();
    return raw ? new Date(raw) : null;
  } catch {
    return null;
  }
}

export function appendLog(root, name, line) {
  fs.appendFileSync(path.join(loopDir(root), 'logs', name), `${nowIso()} ${line}\n`);
}

export { nowIso };
