// Every tunable of the runner, in one place. Override with environment variables
// (set them in the launchd plist / crontab via scripts/install-schedule.mjs, or in .loop/env).

import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile(root) {
  const p = path.join(root, '.loop', 'env');
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

export function loadConfig(root) {
  const env = { ...loadEnvFile(root), ...process.env };
  const num = (k, d) => (env[k] !== undefined && env[k] !== '' ? Number(env[k]) : d);
  return {
    root,
    claudeBin: env.CLAUDE_BIN || 'claude',
    controlBranch: env.LOOP_CONTROL_BRANCH || 'loop/control',
    intervalMin: num('LOOP_INTERVAL_MIN', 30),
    tourTimeoutMin: num('LOOP_TOUR_TIMEOUT_MIN', 90),
    staleMin: num('LOOP_WATCHDOG_STALE_MIN', 120),
    model: env.LOOP_ORCHESTRATOR_MODEL || '', // empty = model declared in .claude/agents/orchestrator.md
    maxTurns: num('LOOP_MAX_TURNS', 400),
    // Lean mode (default): project settings only + no user MCP servers. Without it, the user's own allow rules
    // (e.g. a global "Bash(*)") merge with the pack's allowlist and silently replace it (measured on the bench).
    // Opt out with LOOP_LEAN=0 to use user-level plugins and skills inside the loop.
    lean: env.LOOP_LEAN !== '0',
  };
}
