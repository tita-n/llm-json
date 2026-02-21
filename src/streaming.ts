import type { Result, Schema, StreamingOptions, StreamingParser, PartialParseOptions, Warning } from './types.js';
import { extract } from './extract.js';
import { repair } from './repair.js';
import { parsePartial } from './partial.js';
import { validate } from './validate.js';

/**
 * Create a stateful streaming parser. Call `write(chunk)` for each
 * chunk from the stream, then `finish()` when done.
 * 
 * @param options - Schema, callbacks for update/warning events
 * @returns StreamingParser with write(), finish(), reset() methods
 * 
 * @example
 * const parser = createStreamingParser({ schema });
 * for await (const chunk of llmStream) {
 *   const result = parser.write(chunk);
 *   if (result.ok) updateUI(result.data);
 * }
 * const final = parser.finish();
 */
export function createStreamingParser<T = unknown>(options?: StreamingOptions): StreamingParser<T> {
  const opts = options || {};
  const pOpts: PartialParseOptions = { allowPartialStrings: true, allowPartialObjects: true, allowPartialArrays: true, allowPartialNumbers: false };
  let buf = '', depth = 0, inStr = false, esc = false, started = false;

  const update = (c: string) => {
    buf += c;
    for (let i = buf.length - c.length; i < buf.length; i++) {
      const ch = buf[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\' && inStr) { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{' || ch === '[') {
        if (depth === 0) started = true;
        depth++;
      } else if (ch === '}' || ch === ']') depth--;
    }
  };

  const process = (): Result<T> => {
    const ex = extract(buf);
    if (!ex.json) return { ok: false, error: { code: 'truncated', message: 'No JSON found' } };
    
    const rep = repair(ex.json);
    const res = parsePartial<T>(rep.output, pOpts);
    
    if (res.ok && opts.schema) {
      const v = validate(res.data, opts.schema);
      if (!v.ok) return { ok: false, error: { code: 'schema_mismatch', message: 'Schema mismatch', context: JSON.stringify(v.errors) } };
    }
    return res;
  };

  return {
    get buffer() { return buf; },
    get inJson() { return started; },
    get depth() { return depth; },
    write(c: string): Result<T> { update(c); return process(); },
    finish(): Result<T> {
      if (!started) return { ok: false, error: { code: 'no_json_found', message: 'No JSON found' } };
      if (depth > 0 || inStr) return { ok: false, error: { code: 'truncated', message: 'Incomplete JSON' } };
      return process();
    },
    reset() { buf = ''; depth = 0; inStr = false; esc = false; started = false; }
  };
}

function isAsyncIter(v: unknown): v is AsyncIterable<string> {
  return v != null && typeof (v as AsyncIterable<string>)[Symbol.asyncIterator] === 'function';
}

function isReadableStream(v: unknown): v is ReadableStream {
  return typeof ReadableStream !== 'undefined' && v instanceof ReadableStream;
}

async function* toIter(s: ReadableStream): AsyncIterable<string> {
  const r = s.getReader(), d = new TextDecoder();
  try { while (true) { const { done, value } = await r.read(); if (done) break; yield d.decode(value, { stream: true }); } }
  finally { r.releaseLock(); }
}

/**
 * Parse an async iterable or ReadableStream of chunks.
 * Convenience wrapper around createStreamingParser.
 * 
 * @param chunks - AsyncIterable<string> or ReadableStream
 * @param schema - Optional schema for validation
 * @param options - Streaming callbacks
 * @returns Promise resolving to final result
 * 
 * @example
 * const stream = openai.chat.completions.create({ stream: true, ... });
 * const result = await parseStream(stream, schema);
 */
export async function parseStream<T = unknown>(
  chunks: AsyncIterable<string> | ReadableStream,
  schema?: Schema,
  options?: Omit<StreamingOptions, 'schema'>
): Promise<Result<T>> {
  const p = createStreamingParser<T>({ ...options, schema });
  const it = isReadableStream(chunks) ? toIter(chunks) : isAsyncIter(chunks) ? chunks : null;
  if (!it) return { ok: false, error: { code: 'invalid_json', message: 'Invalid input' } };
  for await (const c of it) p.write(c);
  return p.finish();
}
