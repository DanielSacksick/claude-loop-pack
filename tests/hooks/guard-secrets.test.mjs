import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { tempRepo, bash, runHook } from './helpers.mjs';
import { findSecrets } from '../../template/.claude/hooks/lib/secrets.mjs';

// Fake secrets are assembled at runtime so this file never contains a literal one.
const FAKE_GH = 'ghp_' + 'A'.repeat(36);
const FAKE_AWS = 'AKIA' + 'B'.repeat(16);

test('pattern detection with low false positives', () => {
  assert.deepEqual(findSecrets(`const t = "${FAKE_GH}"`), ['GitHub token']);
  assert.ok(findSecrets(`aws=${FAKE_AWS}`).includes('AWS access key'));
  assert.ok(findSecrets('apiKey: "q8Zr2LkPw9XmT4vB"').length > 0);
  assert.deepEqual(findSecrets('apiKey: process.env.API_KEY'), []);
  assert.deepEqual(findSecrets('password: "your-password-here"'), []);
  assert.deepEqual(findSecrets('DATABASE_URL=postgres://user:changeme@localhost/db'), []);
  assert.ok(findSecrets('DATABASE_URL=postgres://admin:Zx81kqPm@db.prod.io/app').length > 0);
});

test('blocks commit whose staged diff holds a secret', () => {
  const repo = tempRepo('story/S1');
  fs.writeFileSync(path.join(repo, 'cfg.ts'), `export const token = "${FAKE_GH}";\n`);
  execFileSync('git', ['-C', repo, 'add', 'cfg.ts']);
  assert.equal(runHook('guard-secrets.mjs', bash('git commit -m x', repo)).code, 2);
});

test('allows a clean commit', () => {
  const repo = tempRepo('story/S2');
  fs.writeFileSync(path.join(repo, 'ok.ts'), 'export const token = process.env.TOKEN;\n');
  execFileSync('git', ['-C', repo, 'add', 'ok.ts']);
  assert.equal(runHook('guard-secrets.mjs', bash('git commit -m x', repo)).code, 0);
});

test('refuses to stage .env, accepts .env.example', () => {
  const repo = tempRepo('story/S3');
  assert.equal(runHook('guard-secrets.mjs', bash('git add .env', repo)).code, 2);
  assert.equal(runHook('guard-secrets.mjs', bash('git add .env.local', repo)).code, 2);
  assert.equal(runHook('guard-secrets.mjs', bash('git add .env.example', repo)).code, 0);
});

test('Write/Edit: secret in source blocked, in .env allowed', () => {
  const repo = tempRepo();
  const write = (file_path, content) => ({ tool_name: 'Write', tool_input: { file_path, content }, cwd: repo });
  assert.equal(runHook('guard-secrets.mjs', write('src/a.ts', `k="${FAKE_GH}"`)).code, 2);
  assert.equal(runHook('guard-secrets.mjs', write('.env.local', `GH=${FAKE_GH}`)).code, 0);
  const edit = { tool_name: 'Edit', tool_input: { file_path: 'b.ts', new_string: `x="${FAKE_AWS}"` }, cwd: repo };
  assert.equal(runHook('guard-secrets.mjs', edit).code, 2);
});
