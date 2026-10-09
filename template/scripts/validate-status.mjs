#!/usr/bin/env node
// Validates docs/sprint-status.yaml against the schema in docs/orchestrate.md.
// Usage: node scripts/validate-status.mjs [projectDir]   exit 0 = valid, 1 = invalid
// Also prints a one-line summary the tour can quote in its journal.

import path from 'node:path';
import { loadStatus, validateStatus, spentUsd } from '../.claude/hooks/lib/status.mjs';

const root = path.resolve(process.argv[2] || process.cwd());
let loaded;
try {
  loaded = loadStatus(root);
} catch (err) {
  console.error(`sprint-status.yaml unreadable: ${err.message}`);
  process.exit(1);
}
const errors = validateStatus(loaded.data, loaded.text);
if (errors.length) {
  console.error(`sprint-status.yaml INVALID (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
const d = loaded.data;
const count = (st) => (d.stories || []).filter((s) => s.status === st).length;
console.log(
  `valid | loop=${d.loop.status} tour=${d.loop.tour} sprint=${d.loop.current_sprint} ` +
  `stories ready=${count('ready')} active=${count('in_progress') + count('review') + count('changes_requested')} ` +
  `merged=${count('merged')} blocked=${count('blocked')} | spent=${spentUsd(d).toFixed(2)}/${d.budget.total_usd} USD`,
);
