#!/usr/bin/env node
// Installs the scheduled relaunch: tick every 5 min + watchdog every 15 min.
// macOS: two launchd agents in ~/Library/LaunchAgents (survive logout of the terminal, reboot).
// Linux: prints the crontab lines to add.
// Usage: node scripts/install-schedule.mjs [--uninstall] [--print]
// This is a HUMAN step (settings.json denies launchctl/crontab to agents).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = path.basename(ROOT).toLowerCase().replace(/[^a-z0-9]+/g, '-');
const JOBS = [
  { name: 'tick', script: 'scripts/loop-tick.mjs', every: 300 },
  { name: 'watchdog', script: 'scripts/loop-watchdog.mjs', every: 900 },
];
const label = (job) => `com.loop.${slug}.${job.name}`;
const plistPath = (job) => path.join(os.homedir(), 'Library/LaunchAgents', `${label(job)}.plist`);

function which(bin) {
  try {
    return execFileSync('/bin/sh', ['-lc', `command -v ${bin}`], { encoding: 'utf8' }).trim();
  } catch {
    throw new Error(`"${bin}" not found in PATH: install it before scheduling the loop`);
  }
}

function pathEnv() {
  const dirs = ['node', 'claude', 'gh', 'git'].map((b) => path.dirname(which(b)));
  return [...new Set([...dirs, '/usr/bin', '/bin', '/usr/sbin', '/sbin'])].join(':');
}

function plist(job, envPath) {
  const log = path.join(ROOT, '.loop/logs', `launchd-${job.name}.log`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label(job)}</string>
  <key>ProgramArguments</key><array><string>${which('node')}</string><string>${path.join(ROOT, job.script)}</string></array>
  <key>WorkingDirectory</key><string>${ROOT}</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>${envPath}</string>
    <key>HOME</key><string>${os.homedir()}</string>
    <key>LOOP_TRIGGER</key><string>scheduler</string>
  </dict>
  <key>StartInterval</key><integer>${job.every}</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${log}</string>
  <key>StandardErrorPath</key><string>${log}</string>
</dict></plist>
`;
}

function launchctl(...args) {
  try {
    execFileSync('launchctl', args, { stdio: 'ignore' });
  } catch { /* bootout of a missing job is fine */ }
}

function installMac(uninstall) {
  const domain = `gui/${process.getuid()}`;
  const envPath = uninstall ? '' : pathEnv();
  fs.mkdirSync(path.join(ROOT, '.loop/logs'), { recursive: true });
  for (const job of JOBS) {
    launchctl('bootout', `${domain}/${label(job)}`);
    if (uninstall) {
      fs.rmSync(plistPath(job), { force: true });
      console.log(`removed ${label(job)}`);
      continue;
    }
    fs.writeFileSync(plistPath(job), plist(job, envPath));
    execFileSync('launchctl', ['bootstrap', domain, plistPath(job)]);
    console.log(`installed ${label(job)} (every ${job.every / 60} min) -> ${plistPath(job)}`);
  }
}

function printCron() {
  const node = which('node');
  console.log('# Add with `crontab -e`:');
  console.log(`PATH=${pathEnv()}`);
  console.log(`*/5 * * * * cd ${ROOT} && LOOP_TRIGGER=scheduler ${node} scripts/loop-tick.mjs >> .loop/logs/cron-tick.log 2>&1`);
  console.log(`*/15 * * * * cd ${ROOT} && ${node} scripts/loop-watchdog.mjs >> .loop/logs/cron-watchdog.log 2>&1`);
}

const uninstall = process.argv.includes('--uninstall');
if (process.platform === 'darwin' && !process.argv.includes('--print')) installMac(uninstall);
else printCron();
