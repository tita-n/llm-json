import { parse, parsePartial, extract, extractAll, repair, validate, createStreamingParser, parseStream } from './index.js';

console.log('Testing llm-json...\n');

let passed = 0, failed = 0;

function test(name: string, fn: () => boolean) {
  try {
    if (fn()) { console.log(`✓ ${name}`); passed++; }
    else { console.log(`✗ ${name}`); failed++; }
  } catch (e) {
    console.log(`✗ ${name}: ${(e as Error).message}`);
    failed++;
  }
}

function assert<T>(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

test('parse valid JSON', () => {
  const r = parse('{"a": 1}');
  return r.ok && r.data.a === 1;
});

test('parse with schema', () => {
  const r = parse('{"name": "test", "count": 5}', { type: 'object', properties: { name: { type: 'string' }, count: { type: 'number' } } });
  return r.ok && r.data.name === 'test';
});

test('parse with schema mismatch', () => {
  const r = parse('{"name": 123}', { type: 'object', properties: { name: { type: 'string' } } });
  return !r.ok && r.error.code === 'schema_mismatch';
});

test('parse with trailing comma', () => {
  const r = parse('{"a": 1,}');
  return r.ok && r.data.a === 1 && (r.warnings?.length ?? 0) >= 1;
});

test('parse with single quotes', () => {
  const r = parse("{'a': 'b'}");
  return r.ok && r.data.a === 'b';
});

test('parse with unquoted keys', () => {
  const r = parse('{name: "test"}');
  return r.ok && r.data.name === 'test';
});

test('parse with Python literals', () => {
  const r = parse('{a: None, b: True, c: False}');
  return r.ok && r.data.a === null && r.data.b === true && r.data.c === false;
});

test('parse with markdown fence', () => {
  const r = parse('```json\n{"a": 1}\n```');
  return r.ok && r.data.a === 1;
});

test('parse with prose prefix', () => {
  const r = parse('Here is the JSON: {"a": 1}');
  return r.ok && r.data.a === 1;
});

test('parse empty input', () => {
  const r = parse('');
  return !r.ok && r.error.code === 'no_json_found';
});

test('extract JSON', () => {
  const r = extract('prefix {"a": 1} suffix');
  return r.json === '{"a": 1}' && r.start === 7 && r.end === 15;
});

test('extractAll multiple JSONs', () => {
  const r = extractAll('{"a": 1} and {"b": 2}');
  return r.multiple?.length === 2 && r.json === '{"a": 1}';
});

test('repair trailing comma', () => {
  const r = repair('{"a": 1,}');
  return r.output === '{"a": 1}' && r.warnings.length > 0;
});

test('repair single quotes', () => {
  const r = repair("{'a': 'b'}");
  return r.output === '{"a": "b"}' && r.warnings.length > 0;
});

test('parsePartial complete JSON', () => {
  const r = parsePartial('{"a": 1}');
  return r.ok && r.data.a === 1;
});

test('parsePartial incomplete object', () => {
  const r = parsePartial('{"a": 1');
  return r.ok && r.data.a === 1;
});

test('parsePartial incomplete string', () => {
  const r = parsePartial('{"a": "hel');
  return r.ok && r.data.a === 'hel';
});

test('parsePartial incomplete array', () => {
  const r = parsePartial('[1, 2, 3');
  return r.ok && r.data.length === 3;
});

test('validate valid data', () => {
  const r = validate({ a: 'test' }, { type: 'object', properties: { a: { type: 'string' } } });
  return r.ok && r.data?.a === 'test';
});

test('validate missing required', () => {
  const r = validate({}, { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] });
  return !r.ok && r.errors?.some(e => e.code === 'missing_required');
});

test('validate array', () => {
  const r = validate([1, 2, 3], { type: 'array', items: { type: 'number' } });
  return r.ok;
});

test('validate union', () => {
  const r = validate('hello', { type: 'union', variants: [{ type: 'string' }, { type: 'number' }] });
  return r.ok;
});

test('validate literal', () => {
  const r = validate('exact', { type: 'literal', value: 'exact' });
  return r.ok;
});

test('streaming parser basic', async () => {
  const p = createStreamingParser();
  const r1 = p.write('{"a":');
  const r2 = p.write(' 1}');
  const r3 = p.finish();
  return r3.ok && r3.data.a === 1;
});

test('streaming parser chunks', async () => {
  const p = createStreamingParser();
  const chunks = ['{', '"name"', ':', '"test"', '}'];
  for (const c of chunks) p.write(c);
  const r = p.finish();
  return r.ok && r.data.name === 'test';
});

test('streaming parser with schema', async () => {
  const p = createStreamingParser({ schema: { type: 'object', properties: { a: { type: 'number' } } } });
  p.write('{"a": 1}');
  const r = p.finish();
  return r.ok && r.data.a === 1;
});

test('streaming parser schema mismatch', async () => {
  const p = createStreamingParser({ schema: { type: 'object', properties: { a: { type: 'string' } } } });
  p.write('{"a": 1}');
  const r = p.finish();
  return !r.ok && r.error.code === 'schema_mismatch';
});

test('parseStream with async iterable', async () => {
  async function* gen() {
    yield '{"a": ';
    yield '1}';
  }
  const r = await parseStream(gen());
  return r.ok && r.data.a === 1;
});

// String-aware quote handling tests
test('apostrophe in double-quoted string is preserved', () => {
  const r = parse('{"name": "user\'s data"}');
  return r.ok && r.data.name === "user's data";
});

test('apostrophe in double-quoted string via repair', () => {
  const r = repair('{"name": "user\'s data"}');
  return r.valid && r.output === '{"name": "user\'s data"}';
});

test('single-quoted string delimiters converted', () => {
  const r = repair("{'name': 'value'}");
  return r.output === '{"name": "value"}';
});

test('mixed quotes: single delimiters with apostrophe in double-quoted value', () => {
  const r = repair("{'key': \"user's data\"}");
  return r.output === '{"key": "user\'s data"}';
});

test('escaped quote in single-quoted string is unescaped', () => {
  const r = repair("{'text': 'it\\'s'}");
  return r.output === '{"text": "it\'s"}';
});

test('double quote inside single-quoted string is escaped', () => {
  const r = repair("{'text': 'say \"hi\"'}");
  return r.output === '{"text": "say \\"hi\\""}';
});

test('complex mixed quotes and apostrophes', () => {
  const r = parse("{\"name\": 'it\\'s \"quoted\"', value: \"don't\"}");
  return r.ok && r.data.name === 'it\'s "quoted"' && r.data.value === "don't";
});

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
