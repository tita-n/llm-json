import type { ExtractResult } from './types.js';

function findJson(s: string, all: boolean): ExtractResult {
  let depth = 0, inStr = false, esc = false, start = -1;
  const results: string[] = [];
  const positions: { start: number; end: number }[] = [];

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === '\\' && inStr) { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{' || c === '[') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0 && start >= 0) {
        const json = s.slice(start, i + 1);
        results.push(json);
        positions.push({ start, end: i + 1 });
        if (!all) break;
      }
    }
  }

  if (results.length === 0) return { json: null, start: 0, end: 0, multiple: [] };
  return { json: results[0], start: positions[0].start, end: positions[0].end, multiple: results };
}

function stripMd(s: string): string {
  return s.replace(/```(?:json)?\s*\n?([\s\S]*?)\n?```/g, '$1').trim();
}

/**
 * Extract the first JSON object from text. Strips markdown fences
 * and returns the position of the JSON in the original string.
 * 
 * @param input - Text containing JSON (possibly with prose/markdown)
 * @returns Extracted JSON string and position info
 * 
 * @example
 * const { json } = extract('Result: {"a": 1}');
 * // json === '{"a": 1}'
 */
export function extract(input: string): ExtractResult {
  if (!input) return { json: null, start: 0, end: 0 };
  const text = stripMd(input);
  return findJson(text, false);
}

/**
 * Extract all JSON objects from text.
 * 
 * @param input - Text containing multiple JSON objects
 * @returns All extracted JSON strings
 * 
 * @example
 * const { multiple } = extractAll('{"a": 1} and {"b": 2}');
 * // multiple === ['{"a": 1}', '{"b": 2}']
 */
export function extractAll(input: string): ExtractResult {
  if (!input) return { json: null, start: 0, end: 0, multiple: [] };
  const text = stripMd(input);
  return findJson(text, true);
}
