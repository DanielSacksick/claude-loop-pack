import { execFileSync } from 'node:child_process';
import path from 'node:path';

const DEFAULT_PROTECTED = ['main', 'master'];

export function protectedBranches() {
  const extra = (process.env.LOOP_PROTECTED_BRANCHES || '')
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);
  return [...DEFAULT_PROTECTED, ...extra];
}

export function isProtected(branch) {
  return protectedBranches().includes(branch);
}

// symbolic-ref works on an unborn branch (fresh repo, no commit yet), where rev-parse fails:
// without it, the very first commit on main would slip through.
export function currentBranch(cwd) {
  for (const args of [['symbolic-ref', '--short', 'HEAD'], ['rev-parse', '--abbrev-ref', 'HEAD']]) {
    try {
      return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      // try the next form (detached HEAD has no symbolic ref)
    }
  }
  return null;
}

export function gitOutput(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 20 * 1024 * 1024,
  });
}

// Splits `git [-C dir] [-c k=v] <sub> args...` into { cwd, sub, args }.
export function parseGit(tokens, cwd) {
  if (path.basename(tokens[0] || '') !== 'git') return null;
  let i = 1;
  let gitCwd = cwd;
  while (i < tokens.length && tokens[i].startsWith('-')) {
    if (tokens[i] === '-C') {
      gitCwd = path.resolve(gitCwd, tokens[i + 1] || '.');
      i += 2;
    } else if (tokens[i] === '-c') {
      i += 2;
    } else {
      i += 1;
    }
  }
  return { cwd: gitCwd, sub: tokens[i], args: tokens.slice(i + 1) };
}
