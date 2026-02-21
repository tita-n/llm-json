import type { Schema, ValidationResult, ValidationError, ObjectSchema, ArraySchema, UnionSchema } from './types.js';

/**
 * Validate data against a schema. Separate from parsing for when
 * you already have parsed data and want to check it.
 * 
 * @param data - Parsed data to validate
 * @param schema - Schema to validate against
 * @returns Validation result with errors if invalid
 * 
 * @example
 * const result = validate(
 *   { name: 'test' },
 *   { type: 'object', properties: { name: { type: 'string' } } }
 * );
 * // result.ok === true
 */
export function validate<T = unknown>(data: unknown, schema: Schema): ValidationResult<T> {
  const errors = validateValue(data, schema, '');
  return errors.length === 0 ? { ok: true, data: data as T } : { ok: false, errors };
}

function validateValue(d: unknown, s: Schema, p: string): ValidationError[] {
  switch (s.type) {
    case 'null': return d === null ? [] : [{ path: p, code: 'type_error', message: 'Expected null', expected: 'null', actual: typeof d }];
    case 'string': return typeof d === 'string' ? checkEnum(d, s.enum, p) : [{ path: p, code: 'type_error', message: 'Expected string', expected: 'string', actual: typeof d }];
    case 'number': return typeof d === 'number' ? [] : [{ path: p, code: 'type_error', message: 'Expected number', expected: 'number', actual: typeof d }];
    case 'boolean': return typeof d === 'boolean' ? [] : [{ path: p, code: 'type_error', message: 'Expected boolean', expected: 'boolean', actual: typeof d }];
    case 'array': return validateArray(d, s, p);
    case 'object': return validateObject(d, s, p);
    case 'union': return validateUnion(d, s, p);
    case 'literal': return d === s.value ? [] : [{ path: p, code: 'type_error', message: `Expected ${s.value}`, expected: String(s.value), actual: String(d) }];
    default: return [];
  }
}

function checkEnum(d: string, e: string[] | undefined, p: string): ValidationError[] {
  return e && !e.includes(d) ? [{ path: p, code: 'type_error', message: `Not in enum`, expected: e.join('|'), actual: d }] : [];
}

function validateArray(d: unknown, s: ArraySchema, p: string): ValidationError[] {
  if (!Array.isArray(d)) return [{ path: p, code: 'type_error', message: 'Expected array', expected: 'array', actual: typeof d }];
  const e: ValidationError[] = [];
  if (s.minItems !== undefined && d.length < s.minItems) e.push({ path: p, code: 'type_error', message: `Min ${s.minItems} items`, expected: `>=${s.minItems}`, actual: String(d.length) });
  if (s.maxItems !== undefined && d.length > s.maxItems) e.push({ path: p, code: 'type_error', message: `Max ${s.maxItems} items`, expected: `<=${s.maxItems}`, actual: String(d.length) });
  d.forEach((v, i) => e.push(...validateValue(v, s.items, `${p}/${i}`)));
  return e;
}

function validateObject(d: unknown, s: ObjectSchema, p: string): ValidationError[] {
  if (typeof d !== 'object' || d === null || Array.isArray(d)) return [{ path: p, code: 'type_error', message: 'Expected object', expected: 'object', actual: d === null ? 'null' : Array.isArray(d) ? 'array' : typeof d }];
  const e: ValidationError[] = [];
  const obj = d as Record<string, unknown>;
  const req = s.required || [];
  
  for (const k of req) {
    if (!(k in obj)) e.push({ path: `${p}/${k}`, code: 'missing_required', message: `Missing ${k}`, expected: k });
  }
  
  for (const [k, v] of Object.entries(obj)) {
    if (k in s.properties) e.push(...validateValue(v, s.properties[k], `${p}/${k}`));
    else if (s.additionalProperties === false) e.push({ path: `${p}/${k}`, code: 'type_error', message: `Unknown property ${k}` });
  }
  return e;
}

function validateUnion(d: unknown, s: UnionSchema, p: string): ValidationError[] {
  for (const v of s.variants) if (validateValue(d, v, p).length === 0) return [];
  return [{ path: p, code: 'type_error', message: 'No union variant matched', expected: 'union', actual: String(d) }];
}
