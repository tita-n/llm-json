import type { Warning, RepairResult } from './types.js';

/**
 * Repair common JSON issues from LLM output. Handles:
 * - Single quotes (converts to double, preserves apostrophes in strings)
 * - Unquoted keys
 * - Trailing commas
 * - Python literals (None, True, False)
 * - Comments
 * - Markdown fences
 * 
 * @param input - Potentially malformed JSON string
 * @returns Repaired JSON, warnings, and validity flag
 * 
 * @example
 * const { output, valid } = repair("{name: 'John',}");
 * // output === '{"name": "John"}'
 * // valid === true
 */
export function repair(input: string): RepairResult {
  if (!input) return { output: '', warnings: [], valid: false };
  
  const warnings: Warning[] = [];
  let s = input.trim();

  s = s.replace(/```json?\s*\n?/gi, '').replace(/```\s*$/g, '');
  s = s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  s = repairPass(s, warnings);

  {
    const before = s;
    s = s.replace(/,\s*([}\]])/g, '$1');
    if (before !== s) warnings.push({ code: 'trailing_comma_removed', message: '' });
  }

  s = s.replace(/,\s*,/g, ',');

  let valid = false;
  try { JSON.parse(s); valid = true; } catch {}
  
  return { output: s, warnings, valid };
}

function repairPass(s: string, warnings: Warning[]): string {
  let r = '', i = 0;
  let inStr = false;
  let strQuote = '';
  let esc = false;
  let hadSingleQuote = false;
  
  while (i < s.length) {
    const c = s[i];
    
    if (esc) {
      esc = false;
      if (inStr && strQuote === "'") {
        if (c === "'") {
          r += "'";
          i++;
          continue;
        } else if (c === '"') {
          r += '\\"';
          i++;
          continue;
        }
      }
      r += c;
      i++;
      continue;
    }
    
    if (c === '\\' && inStr) {
      if (strQuote === "'") {
        esc = true;
        i++;
        continue;
      }
      esc = true;
      r += c;
      i++;
      continue;
    }
    
    if (c === '"') {
      if (inStr) {
        if (strQuote === '"') {
          inStr = false;
          strQuote = '';
        } else if (strQuote === "'") {
          r += '\\"';
          i++;
          continue;
        }
      } else {
        inStr = true;
        strQuote = '"';
      }
      r += '"';
      i++;
      continue;
    }
    
    if (c === "'") {
      if (inStr) {
        if (strQuote === '"') {
          r += "'";
          i++;
          continue;
        } else if (strQuote === "'") {
          inStr = false;
          strQuote = '';
          hadSingleQuote = true;
        }
      } else {
        inStr = true;
        strQuote = "'";
        hadSingleQuote = true;
      }
      r += '"';
      i++;
      continue;
    }
    
    if (inStr) {
      r += c;
      i++;
      continue;
    }
    
    if (c === '{' || c === ',') {
      r += c; i++;
      while (i < s.length && /\s/.test(s[i])) r += s[i++];
      if (i >= s.length) break;
      
      if (s[i] === '"') {
        inStr = true;
        strQuote = '"';
        r += '"';
        i++;
        continue;
      }
      if (s[i] === "'") {
        inStr = true;
        strQuote = "'";
        hadSingleQuote = true;
        r += '"';
        i++;
        continue;
      }
      
      let ks = i;
      while (i < s.length && /[\w$_]/.test(s[i])) i++;
      if (i > ks && !/^(true|false|null|undefined|None|True|False)$/.test(s.slice(ks, i))) {
        r += '"' + s.slice(ks, i) + '"';
        warnings.push({ code: 'unquoted_key_fixed', message: '' });
      }
      continue;
    }
    
    if (s.slice(i, i + 4) === 'None') {
      r += 'null';
      warnings.push({ code: 'python_literal_converted', message: '' });
      i += 4;
      continue;
    }
    if (s.slice(i, i + 4) === 'True') {
      r += 'true';
      warnings.push({ code: 'python_literal_converted', message: '' });
      i += 4;
      continue;
    }
    if (s.slice(i, i + 5) === 'False') {
      r += 'false';
      warnings.push({ code: 'python_literal_converted', message: '' });
      i += 5;
      continue;
    }
    
    r += c;
    i++;
  }
  
  if (hadSingleQuote) {
    warnings.push({ code: 'single_quotes_replaced', message: '' });
  }
  
  return r;
}
