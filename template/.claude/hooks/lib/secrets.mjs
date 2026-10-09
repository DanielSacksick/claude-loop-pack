// Secret detection patterns. High-signal formats first, then a generic assignment rule
// that ignores obvious placeholders and env lookups to keep false positives low.

export const SECRET_PATTERNS = [
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{50,}\b/],
  ['Anthropic key', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI-style key', /\bsk-(proj-)?[A-Za-z0-9]{32,}\b/],
  ['Stripe live key', /\b(sk|rk)_live_[A-Za-z0-9]{20,}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Private key block', /-----BEGIN ([A-Z]+ )?PRIVATE KEY-----/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ['Connection string with password', /\b[a-z]+:\/\/[^\s:/@]+:[^\s@/]{6,}@[^\s]+/i],
];

const GENERIC = /\b(api[_-]?key|secret|passw(or)?d|token|auth[_-]?key|private[_-]?key)\b["']?\s*[:=]\s*["']([^"'\s]{12,})["']/i;
const PLACEHOLDER = /(example|placeholder|changeme|change_me|your[_-]|xxx|dummy|test|fake|sample|<|\$\{|process\.env|import\.meta\.env)/i;

export function findSecrets(text) {
  const hits = [];
  for (const line of text.split('\n')) {
    for (const [name, re] of SECRET_PATTERNS) {
      const m = line.match(re);
      if (m && !(name.startsWith('Connection') && PLACEHOLDER.test(m[0]))) hits.push(name);
    }
    const g = line.match(GENERIC);
    if (g && !PLACEHOLDER.test(g[3])) hits.push(`hardcoded ${g[1]}`);
  }
  return [...new Set(hits)];
}

// Only lines added by a unified diff, excluding file headers.
export function addedLines(diff) {
  return diff
    .split('\n')
    .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    .map((l) => l.slice(1))
    .join('\n');
}

export function isEnvFile(filePath) {
  const base = filePath.split('/').pop();
  return /^\.env(\..+)?$/.test(base) && !/\.(example|sample|template)$/.test(base);
}
