# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-02-22

### Added

- `parse()` - Main entry point for parsing LLM output with automatic repair and optional schema validation
- `parseWithSchema()` - Type-inferred parsing with schema
- `createStreamingParser()` - Stateful parser for SSE/token-by-token streaming
- `parseStream()` - Parse async iterables and ReadableStreams
- `repair()` - Fix common JSON issues (single quotes, trailing commas, unquoted keys, Python literals)
- `extract()` - Extract first JSON object from text
- `extractAll()` - Extract all JSON objects from text
- `parsePartial()` - Parse incomplete JSON for streaming scenarios
- `validate()` - Schema validation separate from parsing
- `createInstance()` - Create configured instances with custom settings
- `configure()` - Set global configuration options

### Features

- String-aware quote handling: preserves apostrophes inside double-quoted strings
- Handles markdown code blocks (\`\`\`json)
- Strips prose before/after JSON
- Converts Python literals (None, True, False)
- Repairs unquoted keys
- Removes trailing commas
- Zero dependencies
- Works in browser, Node.js, and edge runtimes
- TypeScript support with full type definitions
- 9 KB minified (ESM)

### Schema Support

- Primitive types: string, number, boolean, null
- Arrays with item validation
- Objects with required/optional properties
- Union types
- Literal types
- Enum support for strings
- additionalProperties control

[0.1.0]: https://github.com/yourusername/llm-json/releases/tag/v0.1.0
