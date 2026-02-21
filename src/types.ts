export interface Success<T> {
  ok: true;
  data: T;
  warnings?: Warning[];
}

export interface Failure<T> {
  ok: false;
  error: ParseError;
  partial?: PartialResult<T>;
}

export type Result<T> = Success<T> | Failure<T>;

export interface Warning {
  code: WarningCode;
  message: string;
  position?: number;
}

export type WarningCode =
  | 'trailing_comma_removed'
  | 'single_quotes_replaced'
  | 'unquoted_key_fixed'
  | 'missing_comma_added'
  | 'markdown_fence_stripped'
  | 'prose_stripped'
  | 'python_literal_converted'
  | 'truncated_string_closed'
  | 'unescaped_quote_fixed';

export interface ParseError {
  code: ErrorCode;
  message: string;
  position?: number;
  context?: string;
}

export type ErrorCode =
  | 'no_json_found'
  | 'invalid_json'
  | 'schema_mismatch'
  | 'truncated'
  | 'type_error'
  | 'missing_required';

export interface PartialResult<T> {
  confidence: 'high' | 'medium' | 'low';
  complete: Partial<T>;
  pending: string[];
}

export type Schema =
  | PrimitiveSchema
  | ArraySchema
  | ObjectSchema
  | UnionSchema
  | LiteralSchema;

export interface PrimitiveSchema {
  type: 'string' | 'number' | 'boolean' | 'null';
  enum?: string[];
}

export interface ArraySchema {
  type: 'array';
  items: Schema;
  minItems?: number;
  maxItems?: number;
}

export interface ObjectSchema {
  type: 'object';
  properties: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface UnionSchema {
  type: 'union';
  variants: Schema[];
}

export interface LiteralSchema {
  type: 'literal';
  value: string | number | boolean | null;
}

export type Infer<S extends Schema> = S extends PrimitiveSchema
  ? S['type'] extends 'string'
    ? string
    : S['type'] extends 'number'
      ? number
      : S['type'] extends 'boolean'
        ? boolean
        : null
  : S extends ArraySchema
    ? Infer<S['items']>[]
    : S extends ObjectSchema
      ? { [K in keyof S['properties']]: Infer<S['properties'][K]> }
      : S extends UnionSchema
        ? Infer<S['variants'][number]>
        : S extends LiteralSchema
          ? S['value']
          : unknown;

export interface StreamingOptions {
  schema?: Schema;
  onUpdate?: (result: Result<unknown>) => void;
  onJsonStart?: () => void;
  onJsonComplete?: (data: unknown) => void;
  onWarning?: (warning: Warning) => void;
}

export interface StreamingParser<T = unknown> {
  write(chunk: string): Result<T>;
  finish(): Result<T>;
  reset(): void;
  readonly buffer: string;
  readonly inJson: boolean;
  readonly depth: number;
}

export interface ExtractResult {
  json: string | null;
  start: number;
  end: number;
  multiple?: string[];
}

export interface RepairResult {
  output: string;
  warnings: Warning[];
  valid: boolean;
}

export interface PartialParseOptions {
  allowPartialStrings?: boolean;
  allowPartialObjects?: boolean;
  allowPartialArrays?: boolean;
  allowPartialNumbers?: boolean;
  onIncompleteString?: (str: string) => string;
}

export interface ValidationResult<T> {
  ok: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  path: string;
  code: ErrorCode;
  message: string;
  expected?: string;
  actual?: string;
}

export interface LlmJsonConfig {
  maxBufferSize?: number;
  maxRepairs?: number;
  customRepairs?: RepairRule[];
  collectWarnings?: boolean;
}

export interface RepairRule {
  name: string;
  pattern: RegExp;
  replace: string | ((match: string) => string);
}

export interface LlmJsonInstance {
  parse: <T = unknown>(input: string, schema?: Schema) => Result<T>;
  parseWithSchema: <S extends Schema>(input: string, schema: S) => Result<Infer<S>>;
  createStreamingParser: <T = unknown>(options?: StreamingOptions) => StreamingParser<T>;
  parseStream: <T = unknown>(chunks: AsyncIterable<string> | ReadableStream, schema?: Schema, options?: Omit<StreamingOptions, 'schema'>) => Promise<Result<T>>;
  extract: (input: string) => ExtractResult;
  extractAll: (input: string) => ExtractResult;
  repair: (input: string) => RepairResult;
  parsePartial: <T = unknown>(input: string, options?: PartialParseOptions) => Result<T>;
  validate: <T = unknown>(data: unknown, schema: Schema) => ValidationResult<T>;
}

let globalConfig: LlmJsonConfig = {
  maxBufferSize: 1024 * 1024,
  maxRepairs: 10,
  collectWarnings: true,
};

export function configure(config: LlmJsonConfig): void {
  globalConfig = { ...globalConfig, ...config };
}

export function getConfig(): LlmJsonConfig {
  return globalConfig;
}
