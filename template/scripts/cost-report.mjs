#!/usr/bin/env node
// Cost and speed report from the MEASURED ledger (tours in sprint-status.yaml + archived sprints).
// Usage: node scripts/cost-report.mjs [--json]
// The 72 h projection is an extrapolation of measured averages and is labelled as such.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStatus } from '../.claude/hooks/lib/status.mjs';
import { parseYaml } from '../.claude/hooks/lib/yaml-lite.mjs';
import { loadConfig } from './lib/config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { data } = loadStatus(ROOT);
const cfg = loadConfig(ROOT);

function archivedStories() {
  const dir = path.join(ROOT, 'docs/archive');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.yaml'))
    .flatMap((f) => parseYaml(fs.readFileSync(path.join(dir, f), 'utf8')).stories || []);
}

const tours = data.tours || [];
const stories = [...archivedStories(), ...(data.stories || [])];
const merged = stories.filter((s) => s.status === 'merged').length;
const sum = (k) => tours.reduce((a, t) => a + (Number(t[k]) || 0), 0);
const cost = sum('cost_usd');
const dur = sum('duration_s');
const avgCost = tours.length ? cost / tours.length : 0;
const avgDurMin = tours.length ? dur / tours.length / 60 : 0;
const toursIn72h = avgDurMin ? Math.floor((72 * 60) / (avgDurMin + cfg.intervalMin)) : 0;

const report = {
  tours: tours.length,
  cost_usd: Number(cost.toFixed(2)),
  tokens: { input: sum('input_tokens'), output: sum('output_tokens'), cache_read: sum('cache_read_tokens'), cache_write: sum('cache_write_tokens') },
  avg_tour_cost_usd: Number(avgCost.toFixed(2)),
  avg_tour_minutes: Number(avgDurMin.toFixed(1)),
  stories_merged: merged,
  cost_per_merged_story_usd: merged ? Number((cost / merged).toFixed(2)) : null,
  failed_tours: tours.filter((t) => t.exit !== 'ok').length,
  projection_72h: { tours: toursIn72h, cost_usd: Number((toursIn72h * avgCost).toFixed(0)), note: 'extrapolation of measured averages' },
  budget: { total_usd: data.budget.total_usd, left_usd: Number((data.budget.total_usd - cost).toFixed(2)) },
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('| Tour | Durée (min) | Coût ($) | Tokens out | Tours d\'agent | Sortie |');
  console.log('|---|---|---|---|---|---|');
  for (const t of tours) {
    console.log(`| ${t.n} | ${(t.duration_s / 60).toFixed(1)} | ${Number(t.cost_usd).toFixed(2)} | ${t.output_tokens} | ${t.turns} | ${t.exit} |`);
  }
  console.log(`\nTotal ${report.cost_usd} $ sur ${report.tours} tours, ${merged} stories mergées` +
    (merged ? ` (${report.cost_per_merged_story_usd} $/story)` : '') +
    `. Budget restant ${report.budget.left_usd} $.`);
  console.log(`Projection 72 h (extrapolation) : ~${toursIn72h} tours, ~${report.projection_72h.cost_usd} $.`);
}
