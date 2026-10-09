#!/usr/bin/env node
// Readiness gate (setup-loop step 7): every line must be green before the loop may start.
// Usage: node scripts/readiness.mjs [--json]   exit 0 = ready, 1 = not ready

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStatus, validateStatus } from '../.claude/hooks/lib/status.mjs';
import { checkGit } from '../.claude/hooks/guard-git.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (fs.existsSync(path.join(ROOT, p)) ? fs.readFileSync(path.join(ROOT, p), 'utf8') : '');
const sh = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
};
const repoSlug = () => sh('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']);

const CHECKS = [
  ['PRD validé par l\'humain', () => /^Statut\s*:\s*validé/im.test(read('docs/PRD.md'))],
  ['system-design rédigé', () => read('docs/system-design.md').length > 1500 && !read('docs/system-design.md').includes('{{')],
  ['Maquette validée par l\'humain', () => /<meta name="loop-validated" content="\d{4}-\d{2}-\d{2}"/.test(read('docs/design-mockup.html'))],
  ['Epics avec critères d\'acceptation', () => /Given|Étant donné/i.test(read('docs/epics.md'))],
  ['sprint-status.yaml valide avec un sprint planifié', () => {
    const { data, text } = loadStatus(ROOT);
    return validateStatus(data, text).length === 0 && (data.stories || []).some((s) => s.status === 'ready');
  }],
  ['Budget défini', () => loadStatus(ROOT).data.budget.total_usd > 0],
  ['CLAUDE.md et MAP.md générés pour ce projet', () => !read('CLAUDE.md').includes('{{') && !read('MAP.md').includes('{{')],
  ['Checkout sur loop/control, origin/main existe', () =>
    sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']) === 'loop/control' && sh('git', ['rev-parse', '--verify', 'origin/main']) !== null],
  ['gh authentifié', () => sh('gh', ['auth', 'status']) !== null],
  ['claude headless authentifié et dossier approuvé (allowlist active)', () => {
    let out = '';
    try {
      out = execFileSync('claude', ['-p', 'Réponds OK', '--output-format', 'json', '--model', 'haiku',
        '--max-budget-usd', '0.5', '--permission-mode', 'dontAsk', '--setting-sources', 'project,local', '--strict-mcp-config'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
    } catch (err) {
      out = String(err.stdout || '') + String(err.stderr || '');
    }
    return /"is_error":\s*false/.test(out) && !/not been trusted/.test(out);
  }],
  ['CI verte sur main', () => {
    const out = sh('gh', ['run', 'list', '--branch', 'main', '--limit', '1', '--json', 'conclusion', '-q', '.[0].conclusion']);
    return out === 'success';
  }],
  ['Protection de main (serveur) — facultatif sur plan gratuit privé', () => {
    const slug = repoSlug();
    return slug ? sh('gh', ['api', `repos/${slug}/branches/main/protection`]) !== null : false;
  }, { optional: true }],
  ['Permissions : allowlist + hooks, aucun contournement', () => {
    const s = JSON.parse(read('.claude/settings.json'));
    const raw = JSON.stringify(s);
    return s.permissions?.allow?.length > 0 && s.hooks?.PreToolUse?.length >= 3 && !/bypassPermissions/.test(raw);
  }],
  ['Hook main : un commit sur main est bien bloqué', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ready-'));
    execFileSync('git', ['init', '-q', '-b', 'main', dir]);
    return checkGit({ tool_name: 'Bash', tool_input: { command: 'git commit -m x' }, cwd: dir }) !== null;
  }],
  ['Relance programmée installée', () => {
    if (process.platform !== 'darwin') return (sh('crontab', ['-l']) || '').includes(path.join(ROOT, 'scripts/loop-tick.mjs')) || (sh('crontab', ['-l']) || '').includes(`cd ${ROOT} &&`);
    const slug = path.basename(ROOT).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return fs.existsSync(path.join(os.homedir(), 'Library/LaunchAgents', `com.loop.${slug}.tick.plist`));
  }],
  ['Relance testée (tick à blanc)', () => /dry-run OK/.test(sh('node', ['scripts/loop-tick.mjs', '--dry-run']) || '')],
];

const results = CHECKS.map(([label, fn, meta = {}]) => {
  let ok = false;
  try {
    ok = Boolean(fn());
  } catch {
    ok = false;
  }
  return { label, ok, optional: Boolean(meta.optional) };
});
const ready = results.every((r) => r.ok || r.optional);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ ready, results }, null, 2));
} else {
  for (const r of results) console.log(`${r.ok ? '✅' : r.optional ? '⚠️ ' : '❌'} ${r.label}`);
  console.log(ready ? '\nPRÊT. Lancer la boucle : node scripts/loop-start.mjs' : '\nPAS PRÊT : corriger les ❌ ci-dessus.');
}
process.exit(ready ? 0 : 1);
