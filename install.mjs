#!/usr/bin/env node
// Copies the pack template into a project without overwriting anything that already exists.
// Usage: node install.mjs <projectDir> [--force]
//   --force overwrites pack-owned files (.claude/agents|skills|hooks, scripts/, docs/orchestrate.md)
//   but NEVER the project's own docs (PRD, design, epics, state) or CLAUDE.md/MAP.md.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACK = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(PACK, 'template');
const target = process.argv[2] && path.resolve(process.argv[2]);
const force = process.argv.includes('--force');
const PACK_OWNED = [/^\.claude\/(agents|skills|hooks|rules)\//, /^scripts\//, /^docs\/orchestrate\.md$/];

if (!target) {
  console.error('usage: node install.mjs <projectDir> [--force]');
  process.exit(1);
}
fs.mkdirSync(target, { recursive: true });

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}

const report = { created: [], updated: [], kept: [] };
for (const src of walk(TEMPLATE)) {
  const rel = path.relative(TEMPLATE, src);
  if (rel === '.gitignore.loop') continue;
  const dest = path.join(target, rel);
  const exists = fs.existsSync(dest);
  if (exists && !(force && PACK_OWNED.some((re) => re.test(rel)))) {
    report.kept.push(rel);
    continue;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  (exists ? report.updated : report.created).push(rel);
}

// .claude/settings.json: if the project already has one, keep it and write ours alongside for a manual merge.
const ours = fs.readFileSync(path.join(TEMPLATE, '.claude/settings.json'), 'utf8');
const theirs = path.join(target, '.claude/settings.json');
if (report.kept.includes('.claude/settings.json') && fs.readFileSync(theirs, 'utf8') !== ours) {
  fs.writeFileSync(path.join(target, '.claude/settings.loop.json'), ours);
  console.log('! .claude/settings.json existe déjà : version du pack écrite dans .claude/settings.loop.json, à fusionner (permissions + hooks).');
}

const gi = path.join(target, '.gitignore');
const block = fs.readFileSync(path.join(TEMPLATE, '.gitignore.loop'), 'utf8');
const current = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
if (!current.includes('# --- loop pack ---')) fs.writeFileSync(gi, `${current}${current && !current.endsWith('\n') ? '\n' : ''}${block}`);

console.log(`Pack installé dans ${target}`);
console.log(`  créés : ${report.created.length} · mis à jour : ${report.updated.length} · conservés : ${report.kept.length}`);
if (report.kept.length) console.log(`  conservés (déjà présents) : ${report.kept.slice(0, 12).join(', ')}${report.kept.length > 12 ? '…' : ''}`);
console.log('\nÉtape suivante : ouvrir le projet dans Claude Code et taper /setup-loop');
