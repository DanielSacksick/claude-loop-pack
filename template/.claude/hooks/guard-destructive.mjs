#!/usr/bin/env node
// PreToolUse(Bash): refuses commands that destroy data outside the agent's sandbox.
// Recursive deletes are allowed only strictly inside the project (worktrees included),
// never on the project root, never on .git, never on $HOME or system paths.

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runGuard, projectDir } from './lib/io.mjs';
import { parseCommand, expandHome } from './lib/shell.mjs';

function allowedRoots(root) {
  const extra = (process.env.LOOP_WORKTREES_DIR || '').split(',').filter(Boolean);
  return [root, ...extra.map((p) => path.resolve(root, expandHome(p)))];
}

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function rmTargetReason(target, cwd, root) {
  const resolved = path.resolve(cwd, expandHome(target));
  const base = path.basename(resolved);
  if (base === '.git' || resolved.split(path.sep).includes('.git')) {
    return `rm on git internals (${resolved}) is forbidden`;
  }
  if (target.includes('*') && allowedRoots(root).includes(path.dirname(resolved))) {
    return `glob delete at the project root (${target}) is forbidden`;
  }
  if (!allowedRoots(root).some((r) => isInside(resolved, r))) {
    return `recursive delete outside the project/worktrees (${resolved}) is forbidden`;
  }
  return null;
}

function checkRm(tokens, cwd, root) {
  const flags = tokens.slice(1).filter((t) => t.startsWith('-'));
  const recursive = flags.some((f) => f === '--recursive' || (/^-[a-zA-Z]+$/.test(f) && /[rR]/.test(f)));
  if (!recursive) return null;
  const targets = tokens.slice(1).filter((t) => !t.startsWith('-'));
  if (!targets.length) return null;
  for (const t of targets) {
    const reason = rmTargetReason(t, cwd, root);
    if (reason) return reason;
  }
  return null;
}

const SIMPLE_RULES = [
  [(t) => t[0] === 'sudo', 'sudo is never needed by the loop'],
  [(t) => t[0] === 'mkfs' || t[0]?.startsWith('mkfs.'), 'mkfs is forbidden'],
  [(t) => t[0] === 'dd' && t.some((a) => a.startsWith('of=/dev/')), 'dd to a device is forbidden'],
  [(t) => t[0] === 'gh' && t[1] === 'repo' && t[2] === 'delete', 'gh repo delete is forbidden'],
  [(t) => t[0] === 'gh' && t[1] === 'pr' && t[2] === 'merge' && t.includes('--admin'),
    'gh pr merge --admin bypasses branch protection'],
  [(t) => t[0] === 'git' && t.includes('clean') && t.some((a) => /^-[a-zA-Z]*x/.test(a)),
    'git clean -x deletes ignored files (.env, local state); use a targeted rm inside a worktree'],
  [(t) => t[0] === 'chmod' && t.includes('-R') && t.some((a) => a === '/' || a === '~'),
    'recursive chmod on / or ~ is forbidden'],
];

function checkPipeToShell(command) {
  if (/\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z)?sh\b/.test(command)) {
    return 'piping a download into a shell is forbidden; download, read, then run';
  }
  return null;
}

export function checkDestructive(input) {
  if (input.tool_name !== 'Bash') return null;
  const command = input.tool_input?.command || '';
  const root = projectDir(input);
  const piped = checkPipeToShell(command);
  if (piped) return piped;
  for (const { tokens, cwd } of parseCommand(command, root)) {
    const name = path.basename(tokens[0] || '');
    if (name === 'rm') {
      const reason = checkRm(tokens, cwd, root);
      if (reason) return reason;
    }
    if (name === 'find' && tokens.includes('-delete')) {
      const start = tokens[1] && !tokens[1].startsWith('-') ? tokens[1] : '.';
      const resolved = path.resolve(cwd, expandHome(start));
      // find deletes matches only, so starting at the project root itself is acceptable.
      if (!allowedRoots(root).some((r) => r === resolved || isInside(resolved, r))) {
        return `find -delete outside the project (${resolved}) is forbidden`;
      }
    }
    const rule = SIMPLE_RULES.find(([match]) => match(tokens));
    if (rule) return rule[1];
  }
  return null;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) runGuard(checkDestructive);
