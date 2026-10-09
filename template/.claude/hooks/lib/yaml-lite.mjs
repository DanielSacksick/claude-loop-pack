// Dependency-free parser for the YAML subset used by docs/sprint-status.yaml:
// block maps, block lists (of scalars or maps), one-line flow maps {a: 1} and lists [a, b],
// quoted or plain scalars, null/true/false/numbers, # comments.
// Anything outside the subset throws: the status file is meant to stay simple.

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function splitFlow(body) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (const ch of body) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function splitKey(text) {
  const m = text.match(/^("[^"]*"|'[^']*'|[^:]+?):(\s+|$)(.*)$/);
  if (!m) return null;
  return [m[1].replace(/^["']|["']$/g, ''), m[3]];
}

export function parseScalar(raw) {
  const v = raw.trim();
  if (v === '' || v === '~' || v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (/^".*"$/.test(v)) return JSON.parse(v);
  if (/^'.*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'");
  if (v.startsWith('[') && v.endsWith(']')) return splitFlow(v.slice(1, -1)).map(parseScalar);
  if (v.startsWith('{') && v.endsWith('}')) {
    const obj = {};
    for (const part of splitFlow(v.slice(1, -1))) {
      const kv = splitKey(part);
      if (!kv) throw new Error(`bad flow map entry: ${part}`);
      obj[kv[0]] = parseScalar(kv[1]);
    }
    return obj;
  }
  if (/^[[{]/.test(v)) throw new Error(`unterminated flow value: ${v}`);
  return v;
}

function tokenizeLines(text) {
  return text
    .split('\n')
    .map((raw, i) => ({ raw: stripComment(raw).replace(/\s+$/, ''), n: i + 1 }))
    .filter((l) => l.raw.trim() !== '' && l.raw.trim() !== '---')
    .map((l) => ({ n: l.n, indent: l.raw.match(/^ */)[0].length, text: l.raw.trim() }));
}

function parseBlock(lines, pos, indent) {
  const isList = lines[pos].text.startsWith('- ') || lines[pos].text === '-';
  const out = isList ? [] : {};
  while (pos < lines.length && lines[pos].indent === indent) {
    const line = lines[pos];
    if (isList) {
      // A non-item line at the same indent ends a list written flush with its parent key.
      if (!(line.text.startsWith('- ') || line.text === '-')) break;
      const rest = line.text.slice(1).trim();
      const kv = rest && !/^[[{"']/.test(rest) ? splitKey(rest) : null;
      if (kv) {
        // "- key: value" starts a map whose other keys sit at indent + 2.
        const synthetic = [{ n: line.n, indent: indent + 2, text: rest }];
        let end = pos + 1;
        while (end < lines.length && lines[end].indent > indent) synthetic.push(lines[end++]);
        out.push(parseBlock(synthetic, 0, indent + 2)[0]);
        pos = end;
      } else if (rest) {
        out.push(parseScalar(rest));
        pos++;
      } else {
        const [value, next] = parseBlock(lines, pos + 1, lines[pos + 1].indent);
        out.push(value);
        pos = next;
      }
    } else {
      const kv = splitKey(line.text);
      if (!kv) throw new Error(`line ${line.n}: expected "key: value"`);
      const [key, rest] = kv;
      if (key in out) throw new Error(`line ${line.n}: duplicate key "${key}"`);
      if (rest !== '') {
        out[key] = parseScalar(rest);
        pos++;
      } else if (pos + 1 < lines.length && lines[pos + 1].indent > indent) {
        const [value, next] = parseBlock(lines, pos + 1, lines[pos + 1].indent);
        out[key] = value;
        pos = next;
      } else if (pos + 1 < lines.length && lines[pos + 1].indent === indent && lines[pos + 1].text.startsWith('- ')) {
        const [value, next] = parseBlock(lines, pos + 1, indent);
        out[key] = value;
        pos = next;
      } else {
        out[key] = null;
        pos++;
      }
    }
  }
  if (pos < lines.length && lines[pos].indent > indent) {
    throw new Error(`line ${lines[pos].n}: unexpected indentation`);
  }
  return [out, pos];
}

export function parseYaml(text) {
  const lines = tokenizeLines(text);
  if (!lines.length) return {};
  const [value, pos] = parseBlock(lines, 0, lines[0].indent);
  if (pos < lines.length) throw new Error(`line ${lines[pos].n}: could not parse`);
  return value;
}
