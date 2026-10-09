import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../../template/.claude/hooks/lib/yaml-lite.mjs';
import { validateStatus, spentUsd } from '../../template/.claude/hooks/lib/status.mjs';
import { runHook } from './helpers.mjs';

const TEMPLATE = fs.readFileSync(path.resolve(import.meta.dirname, '../../template/docs/sprint-status.yaml'), 'utf8');

const STORY = (id, extra = '') => `  - id: ${id}
    epic: E1
    title: "Story ${id}"
    status: ready
    depends_on: []
    files: ["src/${id}/**"]
    branch: null
    pr: null
    lock: null
    attempts: 0
    updated: "2026-01-01T00:00:00Z"${extra}
`;

function withStories(stories, tours = 'tours: []\n') {
  return TEMPLATE.replace('epics: []', 'epics:\n  - {id: E1, title: "Auth", status: in_progress}')
    .replace('stories: []', `stories:\n${stories}`)
    .replace(/tours: \[\]\n/, tours)
    .replace('"{{NOW}}"', '"2026-01-01T00:00:00Z"');
}

test('the shipped template parses and validates', () => {
  const data = parseYaml(TEMPLATE);
  assert.equal(data.loop.status, 'setup');
  assert.deepEqual(validateStatus(data, TEMPLATE), []);
});

test('parser handles flush lists, flow maps, comments, quotes', () => {
  const data = parseYaml('a: 1 # c\nlist:\n- x\n- {k: "v # not comment", n: 2}\nb: \'it\'\'s\'\n');
  assert.deepEqual(data, { a: 1, list: ['x', { k: 'v # not comment', n: 2 }], b: "it's" });
});

test('parser rejects duplicate keys', () => {
  assert.throws(() => parseYaml('a: 1\na: 2\n'), /duplicate key/);
});

test('valid stories pass; ledger sums measured costs', () => {
  const text = withStories(STORY('S1-01') + STORY('S1-02'),
    'tours:\n  - {n: 1, cost_usd: 1.25, exit: ok}\n  - {n: 2, cost_usd: 2.5, exit: ok}\n');
  const data = parseYaml(text);
  assert.deepEqual(validateStatus(data, text), []);
  assert.equal(spentUsd(data), 3.75);
});

test('detects bad status, unknown dependency, locks on overlapping files', () => {
  const lock = (id) => `\n    lock: {by: "dev:${id}", since: "2026-01-01T00:00:00Z", branch: "story/${id}"}`;
  const s1 = STORY('S1-01').replace('status: ready', 'status: wip');
  const s2 = STORY('S1-02').replace('depends_on: []', 'depends_on: [S9-99]');
  const s3 = STORY('S1-03').replace('lock: null', lock('S1-03').trim()).replace('"src/S1-03/**"', '"src/shared/**"');
  const s4 = STORY('S1-04').replace('lock: null', lock('S1-04').trim()).replace('"src/S1-04/**"', '"src/shared/db.ts"');
  const text = withStories(s1 + s2 + s3 + s4);
  const errors = validateStatus(parseYaml(text), text).join('\n');
  assert.match(errors, /S1-01: bad status/);
  assert.match(errors, /depends on unknown S9-99/);
  assert.match(errors, /S1-03 and S1-04 are both locked on overlapping files/);
});

test('tours must stay the last key', () => {
  const text = withStories(STORY('S1-01')) + 'extra: 1\n';
  assert.match(validateStatus(parseYaml(text), text).join(), /tours must be the last/);
});

test('budget guard: blocks subagents when spent, or when STOP exists', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loop-budget-'));
  fs.mkdirSync(path.join(dir, 'docs'));
  const file = path.join(dir, 'docs/sprint-status.yaml');
  const agent = { tool_name: 'Agent', tool_input: {}, cwd: dir };
  fs.writeFileSync(file, withStories(STORY('S1-01'), 'tours:\n  - {n: 1, cost_usd: 10, exit: ok}\n'));
  assert.equal(runHook('guard-budget.mjs', agent).code, 0);
  fs.writeFileSync(file, withStories(STORY('S1-01'), 'tours:\n  - {n: 1, cost_usd: 50, exit: ok}\n'));
  assert.equal(runHook('guard-budget.mjs', agent).code, 2);
  fs.writeFileSync(file, withStories(STORY('S1-01')));
  fs.writeFileSync(path.join(dir, 'STOP'), '');
  assert.equal(runHook('guard-budget.mjs', agent).code, 2);
  assert.equal(runHook('guard-budget.mjs', { ...agent, tool_name: 'Bash' }).code, 0);
});
