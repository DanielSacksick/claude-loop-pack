// Reading and validating docs/sprint-status.yaml. Shared by hooks and scripts.

import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from './yaml-lite.mjs';

export const STATUS_FILE = 'docs/sprint-status.yaml';

const ENUMS = {
  loop: ['setup', 'running', 'paused', 'blocked', 'done'],
  epic: ['planned', 'in_progress', 'done'],
  story: ['ready', 'in_progress', 'review', 'changes_requested', 'merged', 'blocked'],
  merge: ['auto', 'manual'],
};
const ACTIVE = ['in_progress', 'review', 'changes_requested'];

export function statusPath(root) {
  return path.join(root, STATUS_FILE);
}

export function loadStatus(root) {
  const text = fs.readFileSync(statusPath(root), 'utf8');
  return { text, data: parseYaml(text) };
}

export function spentUsd(data) {
  return (data.tours || []).reduce((sum, t) => sum + (Number(t?.cost_usd) || 0), 0);
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isIso = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z$/.test(v);

// "src/a/**" and "src/a/b.ts" overlap; so do identical patterns.
function globsOverlap(a, b) {
  const base = (g) => g.replace(/\*.*$/, '');
  const [x, y] = [base(a), base(b)];
  return x.startsWith(y) || y.startsWith(x);
}

function checkTopLevel(data, errors) {
  if (data.version !== 1) errors.push('version must be 1');
  if (!isIso(data.updated) && data.updated !== '{{NOW}}') errors.push('updated must be an ISO 8601 UTC timestamp');
  const loop = data.loop || {};
  if (!ENUMS.loop.includes(loop.status)) errors.push(`loop.status must be one of ${ENUMS.loop.join('|')}`);
  if (!isNum(loop.tour)) errors.push('loop.tour must be a number');
  if (!isNum(loop.no_progress_streak)) errors.push('loop.no_progress_streak must be a number');
  if (loop.status === 'blocked' && !loop.blocked_reason) errors.push('loop.blocked_reason required when blocked');
  const policy = data.policy || {};
  if (!ENUMS.merge.includes(policy.merge)) errors.push('policy.merge must be auto|manual');
  for (const k of ['max_parallel_devs', 'required_reviews', 'lock_ttl_minutes', 'max_attempts']) {
    if (!isNum(policy[k])) errors.push(`policy.${k} must be a number`);
  }
  for (const k of ['total_usd', 'per_tour_usd']) {
    if (!isNum(data.budget?.[k])) errors.push(`budget.${k} must be a number`);
  }
}

function checkStories(data, errors) {
  const epicIds = new Set((data.epics || []).map((e) => e.id));
  for (const e of data.epics || []) {
    if (!ENUMS.epic.includes(e.status)) errors.push(`epic ${e.id}: bad status "${e.status}"`);
  }
  const stories = data.stories || [];
  const ids = new Set();
  for (const s of stories) {
    const where = `story ${s.id}`;
    if (ids.has(s.id)) errors.push(`${where}: duplicate id`);
    ids.add(s.id);
    if (!ENUMS.story.includes(s.status)) errors.push(`${where}: bad status "${s.status}"`);
    if (s.epic && !epicIds.has(s.epic)) errors.push(`${where}: unknown epic ${s.epic}`);
    if (!Array.isArray(s.files) || !s.files.length) errors.push(`${where}: files (ownership) must be a non-empty list`);
    if (!Array.isArray(s.depends_on)) errors.push(`${where}: depends_on must be a list`);
    if (s.lock && !(s.lock.by && isIso(s.lock.since) && s.lock.branch)) errors.push(`${where}: lock needs by, since (ISO), branch`);
    if (ACTIVE.includes(s.status) && !s.branch) errors.push(`${where}: active story needs a branch`);
    if (s.branch && !String(s.branch).startsWith('story/')) errors.push(`${where}: branch must start with story/`);
  }
  for (const s of stories) {
    for (const d of s.depends_on || []) if (!ids.has(d)) errors.push(`story ${s.id}: depends on unknown ${d}`);
  }
  const active = stories.filter((s) => s.lock);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const clash = active[i].files.find((f) => active[j].files.some((g) => globsOverlap(f, g)));
      if (clash) errors.push(`stories ${active[i].id} and ${active[j].id} are both locked on overlapping files (${clash})`);
    }
  }
}

function checkTours(data, text, errors) {
  if (!Array.isArray(data.tours)) errors.push('tours must be a list');
  const keys = text.split('\n').filter((l) => /^[A-Za-z_]+:/.test(l)).map((l) => l.split(':')[0]);
  if (keys[keys.length - 1] !== 'tours') errors.push('tours must be the last top-level key (the runner appends to it)');
}

export function validateStatus(data, text) {
  const errors = [];
  checkTopLevel(data, errors);
  checkStories(data, errors);
  checkTours(data, text, errors);
  return errors;
}
