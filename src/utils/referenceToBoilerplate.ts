/**
 * Builds editable starter code from the model's reference solution: keeps
 * package, imports, and function signatures; replaces each top-level function
 * body with a TODO stub.
 *
 * Limitations: assumes typical lab-shaped Go (package main, imports, funcs).
 * Struct/interface/map/chan/func types in signatures are handled in a minimal
 * way; exotic signatures may fail parsing (returns empty string).
 */

import { formatReferenceSolution } from './formatReferenceSolution';

const BODY_STUB = '\n\t// TODO: implement\n';

function isIdentChar(c: string): boolean {
  return /[a-zA-Z0-9_]/.test(c);
}

function isIdentStart(c: string): boolean {
  return /[a-zA-Z_]/.test(c);
}

function isBoundary(c: string | undefined): boolean {
  return c === undefined || !isIdentChar(c);
}

function skipWs(s: string, i: number): number {
  while (i < s.length && /\s/.test(s[i])) i++;
  return i;
}

function startsWithKeyword(s: string, i: number, kw: string): boolean {
  if (i + kw.length > s.length) return false;
  if (s.slice(i, i + kw.length) !== kw) return false;
  if (i > 0 && isIdentChar(s[i - 1]!)) return false;
  return isBoundary(s[i + kw.length]);
}

function skipIdentifier(s: string, i: number): number {
  if (i >= s.length || !isIdentStart(s[i]!)) return i;
  i++;
  while (i < s.length && isIdentChar(s[i]!)) i++;
  return i;
}

/** Advance past line/block comments or a string starting at i; return i if none. */
function skipStringsAndComments(s: string, i: number): number {
  if (i >= s.length) return i;

  if (s[i] === '/' && s[i + 1] === '/') {
    i += 2;
    while (i < s.length && s[i] !== '\n') i++;
    return i;
  }

  if (s[i] === '/' && s[i + 1] === '*') {
    i += 2;
    while (i + 1 < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++;
    return i + 2 < s.length ? i + 2 : s.length;
  }

  if (s[i] === '`') {
    i++;
    while (i < s.length && s[i] !== '`') i++;
    return Math.min(i + 1, s.length);
  }

  if (s[i] === '"') {
    i++;
    while (i < s.length) {
      if (s[i] === '\\' && i + 1 < s.length) {
        i += 2;
        continue;
      }
      if (s[i] === '"') return i + 1;
      i++;
    }
    return i;
  }

  if (s[i] === "'") {
    i++;
    while (i < s.length) {
      if (s[i] === '\\' && i + 1 < s.length) {
        i += 2;
        continue;
      }
      if (s[i] === "'") return i + 1;
      i++;
    }
    return i;
  }

  return i;
}

function skipBalanced(
  s: string,
  openIdx: number,
  open: string,
  close: string
): number {
  let depth = 1;
  let i = openIdx + 1;
  while (i < s.length && depth > 0) {
    const j = skipStringsAndComments(s, i);
    if (j > i) {
      i = j;
      continue;
    }
    const c = s[i]!;
    if (c === open) depth++;
    else if (c === close) depth--;
    i++;
  }
  return i;
}

function findMatchingCloseBrace(s: string, openBraceIdx: number): number {
  let depth = 1;
  let i = openBraceIdx + 1;
  while (i < s.length && depth > 0) {
    const j = skipStringsAndComments(s, i);
    if (j > i) {
      i = j;
      continue;
    }
    const c = s[i]!;
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  return depth === 0 ? i - 1 : -1;
}

function isFuncKeyword(s: string, i: number): boolean {
  return startsWithKeyword(s, i, 'func');
}

function skipOneType(s: string, i: number): number {
  i = skipWs(s, i);
  if (i >= s.length) return i;

  if (s[i] === '{') return i;

  if (s[i] === '*') {
    return skipOneType(s, i + 1);
  }

  if (s[i] === '<' && s.slice(i, i + 2) === '<-') {
    return skipOneType(s, skipWs(s, i + 2));
  }

  if (startsWithKeyword(s, i, 'chan')) {
    i += 4;
    i = skipWs(s, i);
    if (s[i] === '<' && s[i + 1] === '-') {
      i = skipWs(s, i + 2);
    }
    return skipOneType(s, i);
  }

  if (startsWithKeyword(s, i, 'interface')) {
    i += 'interface'.length;
    i = skipWs(s, i);
    if (i >= s.length || s[i] !== '{') return -1;
    return skipBalanced(s, i, '{', '}');
  }

  if (startsWithKeyword(s, i, 'struct')) {
    i += 'struct'.length;
    i = skipWs(s, i);
    if (i >= s.length || s[i] !== '{') return -1;
    return skipBalanced(s, i, '{', '}');
  }

  if (startsWithKeyword(s, i, 'map')) {
    i += 3;
    i = skipWs(s, i);
    if (i >= s.length || s[i] !== '[') return -1;
    i = skipBalanced(s, i, '[', ']');
    return skipOneType(s, i);
  }

  if (s[i] === '[') {
    i = skipBalanced(s, i, '[', ']');
    return skipOneType(s, i);
  }

  if (s[i] === '(') {
    return skipBalanced(s, i, '(', ')');
  }

  if (startsWithKeyword(s, i, 'func')) {
    return skipFuncTypeSignature(s, i);
  }

  if (isIdentStart(s[i]!)) {
    i = skipIdentifier(s, i);
    if (i < s.length && s[i] === '.') {
      i = skipIdentifier(s, i + 1);
    }
    return i;
  }

  return -1;
}

function skipFuncTypeSignature(s: string, i: number): number {
  if (!startsWithKeyword(s, i, 'func')) return -1;
  i += 4;
  i = skipWs(s, i);
  if (i >= s.length || s[i] !== '(') return -1;
  i = skipBalanced(s, i, '(', ')');
  i = skipWs(s, i);
  if (i >= s.length) return i;
  if (s[i] === '{') return i;
  if (s[i] === '(') {
    return skipBalanced(s, i, '(', ')');
  }
  if (
    isIdentStart(s[i]!) ||
    s[i] === '*' ||
    s[i] === '[' ||
    startsWithKeyword(s, i, 'chan') ||
    startsWithKeyword(s, i, 'map') ||
    startsWithKeyword(s, i, 'interface') ||
    startsWithKeyword(s, i, 'struct') ||
    startsWithKeyword(s, i, 'func') ||
    (s[i] === '<' && s.slice(i, i + 2) === '<-')
  ) {
    return skipOneType(s, i);
  }
  return i;
}

function skipResultType(s: string, i: number): number {
  while (i < s.length) {
    i = skipWs(s, i);
    if (i >= s.length) return i;
    // No named/typed result — body `{` follows `)` immediately.
    if (s[i] === '{') return i;
    const next = skipOneType(s, i);
    if (next < 0) return -1;
    if (next === i) return -1;
    i = next;
  }
  return i;
}

/** Index of `{` that opens the function body, or -1. */
function parseFuncBodyOpenBrace(s: string, funcStart: number): number {
  let i = funcStart + 4;
  i = skipWs(s, i);
  if (i >= s.length) return -1;

  if (s[i] === '(') {
    i = skipBalanced(s, i, '(', ')');
    i = skipWs(s, i);
  }

  if (i >= s.length || !isIdentStart(s[i]!)) return -1;
  i = skipIdentifier(s, i);
  i = skipWs(s, i);

  if (i < s.length && s[i] === '[') {
    i = skipBalanced(s, i, '[', ']');
    i = skipWs(s, i);
  }

  if (i >= s.length || s[i] !== '(') return -1;
  i = skipBalanced(s, i, '(', ')');
  i = skipWs(s, i);

  const afterResult = skipResultType(s, i);
  if (afterResult < 0) return -1;
  i = skipWs(s, afterResult);
  if (i >= s.length || s[i] !== '{') return -1;
  return i;
}

function collectTopLevelFuncBodyInnerRanges(s: string): [number, number][] {
  const ranges: [number, number][] = [];
  let i = 0;
  let braceDepth = 0;

  while (i < s.length) {
    const j = skipStringsAndComments(s, i);
    if (j > i) {
      i = j;
      continue;
    }

    const c = s[i]!;
    if (c === '{') {
      braceDepth++;
      i++;
      continue;
    }
    if (c === '}') {
      braceDepth--;
      i++;
      continue;
    }

    if (braceDepth === 0 && isFuncKeyword(s, i)) {
      const openBrace = parseFuncBodyOpenBrace(s, i);
      if (openBrace < 0) {
        i += 4;
        continue;
      }
      const closeBrace = findMatchingCloseBrace(s, openBrace);
      if (closeBrace < 0) {
        i += 4;
        continue;
      }
      ranges.push([openBrace + 1, closeBrace]);
      i = closeBrace + 1;
      continue;
    }

    i++;
  }

  return ranges;
}

/**
 * Strip implementations from top-level functions in normalized reference Go.
 * Returns empty string if nothing could be stripped (caller may fall back).
 */
export function referenceToBoilerplate(raw: string): string {
  const s = formatReferenceSolution(raw);
  if (!s) return '';

  const ranges = collectTopLevelFuncBodyInnerRanges(s);
  if (ranges.length === 0) return '';

  let out = s;
  for (let k = ranges.length - 1; k >= 0; k--) {
    const [a, b] = ranges[k]!;
    out = out.slice(0, a) + BODY_STUB + out.slice(b);
  }

  return out.replace(/\n{5,}/g, '\n\n\n\n').trimEnd() + '\n';
}
