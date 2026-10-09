// Appends one measured tour to the `tours` list of docs/sprint-status.yaml.
// Values come only from the JSON printed by `claude -p --output-format json`: nothing is estimated here.

import fs from 'node:fs';
import { statusPath } from '../../.claude/hooks/lib/status.mjs';

export function tourFromResult(result, meta) {
  const u = result?.usage || {};
  return {
    n: meta.n,
    start: meta.start,
    end: meta.end,
    duration_s: Math.round((new Date(meta.end) - new Date(meta.start)) / 1000),
    cost_usd: Number((result?.total_cost_usd ?? 0).toFixed(4)),
    input_tokens: u.input_tokens ?? 0,
    output_tokens: u.output_tokens ?? 0,
    cache_read_tokens: u.cache_read_input_tokens ?? 0,
    cache_write_tokens: u.cache_creation_input_tokens ?? 0,
    turns: result?.num_turns ?? 0,
    exit: meta.exit,
    session: result?.session_id ?? null,
  };
}

function flow(obj) {
  const val = (v) => (typeof v === 'string' ? JSON.stringify(v) : v === null ? 'null' : String(v));
  return `{${Object.entries(obj).map(([k, v]) => `${k}: ${val(v)}`).join(', ')}}`;
}

export function appendTour(root, tour) {
  const p = statusPath(root);
  let text = fs.readFileSync(p, 'utf8');
  text = text.replace(/^tours: \[\]\s*$/m, 'tours:');
  if (!text.endsWith('\n')) text += '\n';
  fs.writeFileSync(p, `${text}  - ${flow(tour)}\n`);
}
