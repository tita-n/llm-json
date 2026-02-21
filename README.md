# llm-json

Extract structured data from LLM output. Handles malformed JSON, streaming responses, and partial output — never throws.

## The Problem

LLMs return broken JSON constantly:

```javascript
// What GPT-4 returns:
{name: 'John', age: 30, "bio": "User said "hello"",}

// What JSON.parse sees:
SyntaxError: Expected double-quoted property name
```

**Common failures:**
- Single quotes instead of double quotes
- Unquoted keys (`{name: ...}` instead of `{"name": ...}`)
- Trailing commas
- Apostrophes inside strings (`"user's name"`)
- Markdown code blocks wrapping the JSON
- Prose before/after the JSON
- Python literals (`None`, `True`, `False`)
- Incomplete/truncated JSON from token limits

## Install

```bash
npm install llm-json
```

## Usage

### Basic Parsing

```typescript
import { parse } from 'llm-json';

// Handles all the broken JSON patterns
const result = parse(`
  Here's the data you requested:
  \`\`\`json
  {name: 'John', age: 30, interests: ["ai", "llm's"]}
  \`\`\`
`);

if (result.ok) {
  console.log(result.data.name);     // "John"
  console.log(result.data.interests); // ["ai", "llm's"]
} else {
  console.log(result.error.code);    // "no_json_found" | "invalid_json" | ...
}
```

### With Schema Validation

```typescript
import { parse } from 'llm-json';

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' }
  },
  required: ['name']
};

const result = parse('{name: "Alice", age: "wrong"}', schema);
// result.ok === false
// result.error.code === 'schema_mismatch'
```

### Streaming (SSE / Token-by-Token)

```typescript
import { createStreamingParser } from 'llm-json';

const parser = createStreamingParser({
  schema: { type: 'object', properties: { name: { type: 'string' } } }
});

// Feed chunks as they arrive from OpenAI, Claude, etc.
for await (const chunk of llmStream) {
  const result = parser.write(chunk);
  if (result.ok) {
    updateUI(result.data); // Show partial results in real-time
  }
}

// Get final result
const final = parser.finish();
```

### Extract Multiple JSON Objects

```typescript
import { extractAll } from 'llm-json';

const text = `
  First user: {"id": 1, "name": "Alice"}
  Second user: {"id": 2, "name": "Bob"}
`;

const { multiple } = extractAll(text);
// multiple === [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]
```

## API

### `parse<T>(input: string, schema?: Schema): Result<T>`

Main entry point. Extracts JSON from LLM output, repairs common issues, validates against schema.

```typescript
const result = parse('{"name": "test"}');
if (result.ok) {
  result.data;  // { name: "test" }
  result.warnings; // Repair warnings, if any
} else {
  result.error; // { code, message, position?, context? }
}
```

### `createStreamingParser<T>(options?): StreamingParser<T>`

Stateful parser for streaming responses. Call `write(chunk)` for each chunk, `finish()` when done.

```typescript
const parser = createStreamingParser({ schema });
parser.write(chunk1);
parser.write(chunk2);
const result = parser.finish();
```

### `repair(input: string): RepairResult`

Low-level repair function. Returns repaired JSON string plus warnings.

```typescript
const { output, warnings, valid } = repair("{name: 'test'}");
// output === '{"name": "test"}'
// valid === true
```

### `extract(input: string): ExtractResult`

Extract first JSON object from text. Strips markdown, prose, etc.

```typescript
const { json, start, end } = extract('prefix {"a": 1} suffix');
// json === '{"a": 1}'
```

### `extractAll(input: string): ExtractResult`

Extract all JSON objects from text.

```typescript
const { multiple } = extractAll('{"a": 1} text {"b": 2}');
// multiple === ['{"a": 1}', '{"b": 2}']
```

### `parsePartial<T>(input: string, options?): Result<T>`

Parse potentially incomplete JSON. Useful for streaming when you want manual control.

```typescript
const result = parsePartial('{"users": [{"name": "Al');
// result.ok === true
// result.data === { users: [{ name: "Al" }] }
```

### `validate<T>(data: unknown, schema: Schema): ValidationResult<T>`

Validate parsed data against schema. Separate from parsing for when you already have data.

```typescript
const result = validate({ name: "test" }, { type: 'object', properties: { name: { type: 'string' } } });
// result.ok === true
```

### `parseStream<T>(chunks, schema?, options?): Promise<Result<T>>`

Parse an async iterable or ReadableStream.

```typescript
const result = await parseStream(openaiStream, schema);
```

## Schema Format

Minimal schema format (not JSON Schema — kept small for bundle size):

```typescript
type Schema =
  | { type: 'string' | 'number' | 'boolean' | 'null', enum?: string[] }
  | { type: 'array', items: Schema, minItems?: number, maxItems?: number }
  | { type: 'object', properties: Record<string, Schema>, required?: string[], additionalProperties?: boolean }
  | { type: 'union', variants: Schema[] }
  | { type: 'literal', value: string | number | boolean | null }
```

For complex validation, pipe output through Zod.

## Known Limitations

**repair() edge cases:**
- Cannot fix structural errors (mismatched brackets, completely malformed syntax)
- May produce incorrect output for deeply nested quote escaping (`"a\"b'c\"d"`)
- Doesn't handle JavaScript-style template literals
- Numbers with leading zeros or multiple decimal points not repaired

**Schema limitations:**
- No regex patterns, custom validators, or conditional schemas
- No recursive schema references
- No `$ref` or JSON Schema standard support

**Streaming:**
- Requires explicit `finish()` call — no auto-detection of complete JSON
- Very large strings (>64KB) may cause issues in some environments

## Bundle Size

- ESM: 9.00 KB minified
- CJS: 9.61 KB minified
- Zero dependencies

## License

MIT
