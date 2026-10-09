#!/usr/bin/env node
// PreToolUse(Bash|Write|Edit|MultiEdit): keeps secrets out of the repository.
// - git commit: scans the staged diff (added lines only)
// - git add: refuses to stage real .env files (.env.example is fine)
// - Write/Edit: refuses to write a secret into a non-.env file

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runGuard, projectDir } from './lib/io.mjs';
import { parseCommand } from './lib/shell.mjs';
import { parseGit, gitOutput } from './lib/git.mjs';
import { findSecrets, addedLines, isEnvFile } from './lib/secrets.mjs';

function checkBash(command, root) {
  for (const { tokens, cwd } of parseCommand(command, root)) {
    const git = parseGit(tokens, cwd);
    if (!git) continue;
    if (git.sub === 'add') {
      const env = git.args.find((a) => isEnvFile(a));
      if (env) return `refusing to stage ${env}: env files hold secrets, commit .env.example instead`;
    }
    if (git.sub === 'commit') {
      const stagesAll = git.args.some((a) => /^-[a-zA-Z]*a/.test(a) || a === '--all');
      const diff = gitOutput(git.cwd, ['diff', stagesAll ? 'HEAD' : '--cached', '--no-color']);
      const hits = findSecrets(addedLines(diff));
      if (hits.length) return `staged diff contains possible secrets (${hits.join(', ')}); move them to env vars`;
    }
  }
  return null;
}

function checkWrite(input) {
  const filePath = input.tool_input?.file_path || '';
  if (isEnvFile(filePath)) return null; // local env files are the right place for secrets
  const ti = input.tool_input || {};
  const text = [ti.content, ti.new_string, ...(ti.edits || []).map((e) => e.new_string)]
    .filter(Boolean)
    .join('\n');
  const hits = findSecrets(text);
  if (hits.length) {
    return `writing possible secrets into ${path.basename(filePath)} (${hits.join(', ')}); read them from env vars`;
  }
  return null;
}

export function checkSecrets(input) {
  if (input.tool_name === 'Bash') {
    const command = input.tool_input?.command || '';
    if (!/\bgit\b/.test(command)) return null;
    return checkBash(command, projectDir(input));
  }
  if (['Write', 'Edit', 'MultiEdit'].includes(input.tool_name)) return checkWrite(input);
  return null;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) runGuard(checkSecrets);
