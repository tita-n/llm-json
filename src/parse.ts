import type { Result, Schema, Infer, LlmJsonConfig, LlmJsonInstance, StreamingOptions } from './types.js';
import { extract, extractAll } from './extract.js';
import { repair } from './repair.js';
import { parsePartial } from './partial.js';
import { validate } from './validate.js';
import { createStreamingParser, parseStream } from './streaming.js';

/**
 * Parse LLM output into structured data. Extracts JSON from text,
 * repairs common issues (single quotes, trailing commas, etc.),
 * and optionally validates against a schema. Never throws.
 * 
 * @param input - Raw LLM output (may contain prose, markdown, etc.)
 * @param schema - Optional schema for validation
 * @returns Result object with `ok` flag, data/error, and optional warnings
 * 
 * @example
 * const result = parse('{name: "John", age: 30,}');
 * if (result.ok) {
 *   console.log(result.data.name); // "John"
 * }
 */
export function parse<T = unknown>(input: string, schema?: Schema): Result<T> {
  if (!input) return { ok: false, error: { code: 'no_json_found', message: 'Empty input' } };
  
  const ex = extract(input);
  if (!ex.json) return { ok: false, error: { code: 'no_json_found', message: 'No JSON found' } };
  
  try {
    const d = JSON.parse(ex.json) as T;
    if (schema) { const v = validate(d, schema); if (!v.ok) return { ok: false, error: { code: 'schema_mismatch', message: 'Schema mismatch', context: JSON.stringify(v.errors) } }; }
    return { ok: true, data: d };
  } catch {}
  
  const rep = repair(ex.json);
  try {
    const d = JSON.parse(rep.output) as T;
    if (schema) { const v = validate(d, schema); if (!v.ok) return { ok: false, error: { code: 'schema_mismatch', message: 'Schema mismatch', context: JSON.stringify(v.errors) } }; }
    return { ok: true, data: d, warnings: rep.warnings.length ? rep.warnings : undefined };
  } catch (e) {
    return { ok: false, error: { code: 'invalid_json', message: (e as Error).message } };
  }
}

/**
 * Parse with schema, inferring the return type from the schema.
 * 
 * @param input - Raw LLM output
 * @param schema - Schema to validate against
 * @returns Typed result
 * 
 * @example
 * const schema = { type: 'object', properties: { name: { type: 'string' } } } as const;
 * const result = parseWithSchema('{name: "test"}', schema);
 * if (result.ok) result.data.name; // typed as string
 */
export function parseWithSchema<S extends Schema>(input: string, schema: S): Result<Infer<S>> {
  return parse<Infer<S>>(input, schema);
}

/**
 * Create a configured instance of llm-json with custom settings.
 * Useful when you need different settings for different use cases.
 * 
 * @param config - Configuration options
 * @returns Object with all parse/validate/extract functions
 * 
 * @example
 * const parser = createInstance({ maxRepairs: 5 });
 * const result = parser.parse(input);
 */
export function createInstance(config?: LlmJsonConfig): LlmJsonInstance {
  return {
    parse: (i, s) => parse(i, s),
    parseWithSchema: (i, s) => parseWithSchema(i, s),
    createStreamingParser: (o) => createStreamingParser(o),
    parseStream: (c, s, o) => parseStream(c, s, o),
    extract: (i) => extract(i),
    extractAll: (i) => extractAll(i),
    repair: (i) => repair(i),
    parsePartial: (i, o) => parsePartial(i, o),
    validate: (d, s) => validate(d, s),
  };
}
