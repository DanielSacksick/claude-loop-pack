import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { tempRepo, bash, runHook } from './helpers.mjs';

const blocked = (cmd, cwd, env) => runHook('guard-git.mjs', bash(cmd, cwd), env).code === 2;

test('blocks commit on main, allows on story branch', () => {
  const main = tempRepo('main');
  assert.equal(blocked('git commit -m x', main), true);
  const story = tempRepo('story/S1');
  assert.equal(blocked('git commit -m x', story), false);
});

test('reads the branch of the directory the command targets, not the project root', () => {
  const root = tempRepo('main');
  const wt = tempRepo('story/S2');
  assert.equal(blocked(`cd ${wt} && git commit -m x`, root), false);
  assert.equal(blocked(`git -C ${wt} commit -m x`, root), false);
  assert.equal(blocked(`git -C ${root} commit -m x`, wt), true);
});

test('tracks an in-command checkout', () => {
  const story = tempRepo('story/S3');
  assert.equal(blocked('git checkout main && git commit -m x', story), true);
  const main = tempRepo('main');
  assert.equal(blocked('git checkout -b story/S4 && git commit -m x', main), false);
});

test('blocks push to main in every spelling', () => {
  const story = tempRepo('story/S5');
  for (const cmd of [
    'git push origin main',
    'git push origin HEAD:main',
    'git push origin story/S5:refs/heads/main',
    'git push --all',
  ]) assert.equal(blocked(cmd, story), true, cmd);
  const main = tempRepo('main');
  assert.equal(blocked('git push', main), true);
  assert.equal(blocked('git push origin story/S5', story), false);
  assert.equal(blocked('git push -u origin HEAD', story), false);
});

test('force push allowed only on story/* (rebase behind main needs it)', () => {
  const story = tempRepo('story/S6');
  assert.equal(blocked('git push --force-with-lease origin story/S6', story), false);
  assert.equal(blocked('git push --force-with-lease', story), false);
  assert.equal(blocked('git push -f origin loop/control', story), true);
  assert.equal(blocked('git push origin +feature/x', story), true);
});

test('blocks reset --hard on main and protected branch deletion', () => {
  const main = tempRepo('main');
  assert.equal(blocked('git reset --hard origin/main', main), true);
  const story = tempRepo('story/S7');
  assert.equal(blocked('git reset --hard origin/main', story), false);
  assert.equal(blocked('git branch -D main', story), true);
});

test('extra protected branches via env', () => {
  const ctl = tempRepo('loop/control');
  assert.equal(blocked('git commit -m x', ctl), false);
  assert.equal(blocked('git commit -m x', ctl, { LOOP_PROTECTED_BRANCHES: 'loop/control' }), true);
});

test('ignores non-git commands and other tools', () => {
  const main = tempRepo('main');
  assert.equal(blocked('npm test', main), false);
  assert.equal(runHook('guard-git.mjs', { tool_name: 'Read', tool_input: {}, cwd: main }).code, 0);
  assert.ok(path.isAbsolute(main));
  execFileSync('true');
});

test('blocks the very first commit on an unborn main branch', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loop-unborn-'));
  execFileSync('git', ['init', '-q', '-b', 'main', dir]);
  assert.equal(blocked('git commit -m first', dir), true);
});
