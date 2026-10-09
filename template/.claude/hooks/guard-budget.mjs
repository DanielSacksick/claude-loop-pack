#!/usr/bin/env node
// PreToolUse(Agent|Task): no new subagent once the global budget is spent or a STOP file exists.
// The per-tour ceiling is enforced natively by `claude -p --max-budget-usd` (see scripts/loop-runner.sh);
// this guard covers the global ceiling, which only the measured ledger in sprint-status.yaml knows.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runGuard, projectDir } from './lib/io.mjs';
import { loadStatus, spentUsd } from './lib/status.mjs';

export function checkBudget(input) {
  if (!['Agent', 'Task'].includes(input.tool_name)) return null;
  const root = projectDir(input);
  if (fs.existsSync(path.join(root, 'STOP'))) {
    return 'STOP file present at the project root: finish the current step, record state, end the tour';
  }
  let status;
  try {
    status = loadStatus(root).data;
  } catch {
    return null; // no status yet (setup phase): nothing to enforce
  }
  const total = Number(status.budget?.total_usd);
  if (!total) return null;
  const spent = spentUsd(status);
  if (spent >= total) {
    return `global budget spent (${spent.toFixed(2)} / ${total} USD): set loop.status to blocked and stop`;
  }
  return null;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) runGuard(checkBudget);
