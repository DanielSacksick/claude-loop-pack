// Minimal shell parsing, enough to reason about agent commands.
// Not a full POSIX parser: it splits on control operators outside quotes,
// tokenizes with quote handling, and tracks `cd` so each segment knows its cwd.

import path from 'node:path';
import os from 'node:os';

const OPERATORS = ['&&', '||', ';', '|', '\n', '&'];

export function splitSegments(command) {
  const segments = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    const op = OPERATORS.find((o) => command.startsWith(o, i));
    if (op) {
      segments.push(current);
      current = '';
      i += op.length - 1;
      continue;
    }
    current += ch;
  }
  segments.push(current);
  return segments.map((s) => s.trim()).filter(Boolean);
}

export function tokenize(segment) {
  const tokens = [];
  let current = '';
  let quote = null;
  let started = false;
  for (const ch of segment) {
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (started) tokens.push(current);
      current = '';
      started = false;
      continue;
    }
    current += ch;
    started = true;
  }
  if (started) tokens.push(current);
  // Drop leading env assignments (FOO=bar cmd ...) and `sudo`/`command` wrappers.
  while (tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) tokens.shift();
  while (tokens.length && ['command', 'builtin', 'exec', 'nohup', 'time'].includes(tokens[0])) tokens.shift();
  return tokens;
}

export function expandHome(p) {
  if (p === '~' || p === '$HOME' || p === '${HOME}') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  if (p.startsWith('$HOME/')) return path.join(os.homedir(), p.slice(6));
  return p;
}

// Returns [{ tokens, cwd }] with cwd resolved by following `cd` segments.
export function parseCommand(command, startCwd) {
  let cwd = startCwd;
  const parsed = [];
  for (const segment of splitSegments(command)) {
    const tokens = tokenize(segment.replace(/^[({]\s*|\s*[)}]$/g, ''));
    if (!tokens.length) continue;
    if (tokens[0] === 'cd') {
      const target = tokens[1] ? expandHome(tokens[1]) : os.homedir();
      cwd = path.resolve(cwd, target);
      continue;
    }
    parsed.push({ tokens, cwd });
  }
  return parsed;
}
