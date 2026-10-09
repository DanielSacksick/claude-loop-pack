#!/usr/bin/env node
// PreToolUse(Bash): no commit on a protected branch, no push to it, no history rewrite
// outside story branches. Protected = main, master + $LOOP_PROTECTED_BRANCHES.
// Force push is only allowed on branches starting with $LOOP_FORCE_OK_PREFIX (default story/),
// because rebasing a story branch behind main legitimately needs --force-with-lease.

import { pathToFileURL } from 'node:url';
import { runGuard, projectDir } from './lib/io.mjs';
import { parseCommand } from './lib/shell.mjs';
import { currentBranch, isProtected, parseGit } from './lib/git.mjs';

const WRITES_ON_CURRENT = ['commit', 'merge', 'cherry-pick', 'revert', 'am'];
const FORCE_FLAGS = ['-f', '--force', '--force-with-lease', '--force-if-includes'];

function forceOkPrefix() {
  return process.env.LOOP_FORCE_OK_PREFIX || 'story/';
}

function stripRef(ref) {
  return ref.replace(/^\+/, '').replace(/^refs\/heads\//, '');
}

function pushTargets(args, branch) {
  const positional = args.filter((a) => !a.startsWith('-'));
  const refspecs = positional.slice(1); // first positional is the remote
  if (!refspecs.length) return [branch];
  return refspecs.map((spec) => {
    const dest = spec.includes(':') ? spec.split(':')[1] : spec;
    return stripRef(dest === 'HEAD' || dest === '' ? branch : dest);
  });
}

function checkPush(args, branch) {
  if (args.includes('--all') || args.includes('--mirror')) {
    return 'push --all/--mirror can rewrite protected branches; push one story branch at a time';
  }
  const targets = pushTargets(args, branch);
  const hit = targets.find((t) => t && isProtected(t));
  if (hit) return `push to protected branch "${hit}" is forbidden; open a PR from a story/* branch`;
  const forced = args.some((a) => FORCE_FLAGS.includes(a) || a.startsWith('--force-with-lease='))
    || args.some((a) => !a.startsWith('-') && a.startsWith('+'));
  if (forced) {
    const bad = targets.find((t) => !t || !t.startsWith(forceOkPrefix()));
    if (bad !== undefined) {
      return `force push only allowed on ${forceOkPrefix()}* branches (target: "${bad || 'unknown'}")`;
    }
  }
  return null;
}

function checkSegment(git, branch) {
  const { sub, args } = git;
  if (WRITES_ON_CURRENT.includes(sub) && isProtected(branch)) {
    return `git ${sub} on protected branch "${branch}" is forbidden; work on story/<id> in a worktree`;
  }
  if (sub === 'push') return checkPush(args, branch);
  if (sub === 'reset' && args.includes('--hard') && isProtected(branch)) {
    return `git reset --hard on protected branch "${branch}" is forbidden`;
  }
  if (sub === 'branch' && args.some((a) => ['-D', '-d', '--delete', '-M', '-m'].includes(a))) {
    const hit = args.find((a) => isProtected(a));
    if (hit) return `deleting or renaming protected branch "${hit}" is forbidden`;
  }
  if (sub === 'update-ref' || (sub === 'filter-branch') || (sub === 'replace')) {
    return `git ${sub} rewrites refs directly; not allowed in the loop`;
  }
  return null;
}

export function checkGit(input) {
  if (input.tool_name !== 'Bash') return null;
  const command = input.tool_input?.command || '';
  if (!/\bgit\b/.test(command)) return null;
  const assumed = new Map(); // cwd -> branch after an in-command checkout/switch
  for (const { tokens, cwd } of parseCommand(command, projectDir(input))) {
    const git = parseGit(tokens, cwd);
    if (!git) continue;
    const branch = assumed.get(git.cwd) ?? currentBranch(git.cwd);
    if (['checkout', 'switch'].includes(git.sub)) {
      const target = git.args.filter((a) => !a.startsWith('-')).pop();
      const creates = git.args.some((a) => ['-b', '-B', '-c', '-C'].includes(a));
      if (target && (creates || !target.includes('.'))) assumed.set(git.cwd, target);
      continue;
    }
    const reason = checkSegment(git, branch);
    if (reason) return reason;
  }
  return null;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) runGuard(checkGit);
