import {
  ForecastInputSchema,
  ForecastResultSchema,
  type ForecastInput,
  type ForecastResult,
} from "@tanso-hq/credit-forecast-schema";

export interface JsonImportIssue {
  readonly code: "INVALID_JSON" | "INVALID_FORECAST_INPUT" | "INVALID_FORECAST_RESULT";
  readonly path: string;
  readonly message: string;
}

export class JsonImportError extends Error {
  readonly issues: readonly JsonImportIssue[];

  constructor(message: string, issues: readonly JsonImportIssue[]) {
    super(message);
    this.name = "JsonImportError";
    this.issues = issues;
  }
}

type JsonPrimitive = null | boolean | number | string;
type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

function sortJson(value: unknown): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, child]) => [key, sortJson(child)]),
    );
  }
  throw new TypeError(`Unsupported JSON value: ${typeof value}`);
}

function serialize(value: unknown): string {
  return `${JSON.stringify(sortJson(value), null, 2)}\n`;
}

function parseJson(source: string): unknown {
  try {
    return JSON.parse(source) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new JsonImportError("JSON could not be parsed", [
      { code: "INVALID_JSON", path: "$", message },
    ]);
  }
}

function schemaIssues(
  error: {
    readonly issues: readonly {
      readonly path: readonly (string | number)[];
      readonly message: string;
    }[];
  },
  code: "INVALID_FORECAST_INPUT" | "INVALID_FORECAST_RESULT",
): readonly JsonImportIssue[] {
  return error.issues.map((issue) => ({
    code,
    path: issue.path.length === 0 ? "$" : `$.${issue.path.join(".")}`,
    message: issue.message,
  }));
}

export function serializeForecastInput(input: ForecastInput): string {
  return serialize(ForecastInputSchema.parse(input));
}

export function parseForecastInput(source: string): ForecastInput {
  const parsed = ForecastInputSchema.safeParse(parseJson(source));
  if (!parsed.success) {
    throw new JsonImportError(
      "JSON does not contain a valid ForecastInput",
      schemaIssues(parsed.error, "INVALID_FORECAST_INPUT"),
    );
  }
  return parsed.data;
}

export function serializeForecastResult(result: ForecastResult): string {
  return serialize(ForecastResultSchema.parse(result));
}

export function parseForecastResult(source: string): ForecastResult {
  const parsed = ForecastResultSchema.safeParse(parseJson(source));
  if (!parsed.success) {
    throw new JsonImportError(
      "JSON does not contain a valid ForecastResult",
      schemaIssues(parsed.error, "INVALID_FORECAST_RESULT"),
    );
  }
  return parsed.data;
}
