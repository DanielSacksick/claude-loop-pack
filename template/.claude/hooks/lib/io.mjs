// Hook I/O contract shared by every guard.
// Claude Code sends the tool call as JSON on stdin. Exit code 2 blocks the call
// and stderr is shown to the agent so it can correct course. Exit 0 lets it through.

import fs from 'node:fs';
import path from 'node:path';

export async function readHookInput(stream = process.stdin) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function projectDir(input) {
  return process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
}

// Every block is appended to .loop/logs/guards.log: the security axis of the scorecard counts them.
function logBlock(input, hook, reason) {
  try {
    const dir = path.join(projectDir(input), '.loop', 'logs');
    fs.mkdirSync(dir, { recursive: true });
    const what = input.tool_input?.command || input.tool_input?.file_path || input.tool_name;
    fs.appendFileSync(path.join(dir, 'guards.log'), `${new Date().toISOString()}\t${hook}\t${reason}\t${String(what).slice(0, 200)}\n`);
  } catch {
    // logging must never change the decision
  }
}

// A guard is a pure function (input) => null | "reason". The runner turns it into an exit code.
export async function runGuard(guard) {
  const input = await readHookInput();
  let reason = null;
  try {
    reason = await guard(input);
  } catch (err) {
    // A crashing guard must not silently allow: fail closed, but explain.
    reason = `guard error (${err.message}); refusing to be safe`;
  }
  if (reason) {
    const hook = process.argv[1].split('/').pop();
    process.stderr.write(`BLOCKED by ${hook}: ${reason}\n`);
    logBlock(input, hook, reason);
    process.exit(2);
  }
  process.exit(0);
}
