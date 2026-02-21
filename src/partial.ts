import type { Result, PartialParseOptions } from './types.js';

/**
 * Parse potentially incomplete JSON. Useful for streaming when you
 * want manual control over the parsing process.
 * 
 * @param input - Possibly incomplete JSON string
 * @param options - Control which types can be partial
 * @returns Best-effort parsed result
 * 
 * @example
 * const result = parsePartial('{"users": [{"name": "Al');
 * // result.ok === true
 * // result.data === { users: [{ name: "Al" }] }
 */
export function parsePartial<T = unknown>(input: string, options?: PartialParseOptions): Result<T> {
  if (!input) return { ok: false, error: { code: 'no_json_found', message: 'Empty input' } };
  
  try { return { ok: true, data: JSON.parse(input) as T }; } catch {}
  
  const opts = { allowPartialStrings: true, allowPartialObjects: true, allowPartialArrays: true, allowPartialNumbers: false, ...options };
  
  try {
    const data = doParse(input, opts) as T;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: { code: 'truncated', message: (e as Error).message }, partial: { confidence: 'medium', complete: {}, pending: [] } };
  }
}

function doParse(s: string, opts: PartialParseOptions): unknown {
  let i = 0;
  
  const skip = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  const peek = () => s[i];
  const take = () => s[i++];
  
  const parseValue = (): unknown => {
    skip();
    const c = peek();
    if (c === '{') return parseObj();
    if (c === '[') return parseArr();
    if (c === '"') return parseStr();
    if (c === '-' || /[0-9]/.test(c)) return parseNum();
    if (s.slice(i, i + 4) === 'true') { i += 4; return true; }
    if (s.slice(i, i + 5) === 'false') { i += 5; return false; }
    if (s.slice(i, i + 4) === 'null') { i += 4; return null; }
    throw new Error('Unexpected token at ' + i);
  };
  
  const parseStr = (): string => {
    take();
    let r = '', esc = false;
    while (i < s.length) {
      const c = take();
      if (esc) { esc = false; r += c; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') return r;
      r += c;
    }
    if (opts.allowPartialStrings) return r;
    throw new Error('Unterminated string');
  };
  
  const parseNum = (): number => {
    const start = i;
    if (peek() === '-') take();
    while (i < s.length && /[0-9]/.test(s[i])) take();
    if (peek() === '.') {
      take();
      while (i < s.length && /[0-9]/.test(s[i])) take();
    }
    if (peek() === 'e' || peek() === 'E') {
      take();
      if (peek() === '+' || peek() === '-') take();
      while (i < s.length && /[0-9]/.test(s[i])) take();
    }
    let num = s.slice(start, i);
    if (opts.allowPartialNumbers && num.endsWith('.')) num = num.slice(0, -1);
    return parseFloat(num);
  };
  
  const parseArr = (): unknown[] => {
    take();
    const arr: unknown[] = [];
    skip();
    if (peek() === ']') { take(); return arr; }
    
    while (i < s.length) {
      skip();
      if (peek() === ']') { take(); return arr; }
      if (peek() === ',') { take(); continue; }
      arr.push(parseValue());
    }
    if (opts.allowPartialArrays) return arr;
    throw new Error('Unterminated array');
  };
  
  const parseObj = (): Record<string, unknown> => {
    take();
    const obj: Record<string, unknown> = {};
    skip();
    if (peek() === '}') { take(); return obj; }
    
    while (i < s.length) {
      skip();
      if (peek() === '}') { take(); return obj; }
      if (peek() === ',') { take(); continue; }
      
      const key = parseStr();
      skip();
      if (peek() !== ':') {
        if (opts.allowPartialObjects) return obj;
        throw new Error('Expected colon');
      }
      take();
      skip();
      obj[key] = parseValue();
    }
    if (opts.allowPartialObjects) return obj;
    throw new Error('Unterminated object');
  };
  
  return parseValue();
}
