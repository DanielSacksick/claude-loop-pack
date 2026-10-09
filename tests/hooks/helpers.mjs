import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const HOOKS = path.resolve(import.meta.dirname, '../../template/.claude/hooks');

// Creates a throwaway repo on `branch` with one commit, returns its path.
export function tempRepo(branch = 'main') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loop-hook-'));
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { stdio: 'ignore' });
  git('init', '-q', '-b', branch);
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a\n');
  git('add', '.');
  git('commit', '-qm', 'init');
  return dir;
}

export function bash(command, cwd) {
  return { tool_name: 'Bash', tool_input: { command }, cwd };
}

// Runs a hook as Claude Code would: JSON on stdin, returns { code, stderr }.
export function runHook(file, input, env = {}) {
  try {
    execFileSync('node', [path.join(HOOKS, file)], {
      input: JSON.stringify(input),
      env: { ...process.env, CLAUDE_PROJECT_DIR: input.cwd, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { code: 0, stderr: '' };
  } catch (err) {
    return { code: err.status, stderr: String(err.stderr) };
  }
}
