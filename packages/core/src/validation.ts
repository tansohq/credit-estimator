import {
  ForecastInputSchema,
  type ForecastInput,
  type ForecastValidationFailure,
  type ValidationIssue,
} from "@tanso-hq/credit-forecast-schema";

interface RawSchemaIssue {
  readonly code: string;
  readonly path: readonly (string | number)[];
  readonly message: string;
  readonly params?: { readonly forecastCode?: unknown };
  readonly received?: unknown;
  readonly keys?: readonly string[];
}

const portableVersion = (input: unknown, key: string): string | null => {
  if (typeof input !== "object" || input === null) {
    return null;
  }
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const pathToString = (path: readonly (string | number)[]): string =>
  path.reduce<string>(
    (result, segment) =>
      typeof segment === "number" ? `${result}[${segment}]` : `${result}.${segment}`,
    "input",
  );

const schemaIssueCode = (issue: RawSchemaIssue): string => {
  if (typeof issue.params?.forecastCode === "string") {
    return issue.params.forecastCode;
  }
  if (issue.code === "invalid_type" && issue.received === "undefined") {
    return "REQUIRED_FIELD";
  }
  if (issue.code === "unrecognized_keys") {
    return "UNRECOGNIZED_FIELD";
  }

  const path = pathToString(issue.path);
  if (path.endsWith("Date") || path.endsWith(".asOf") || path.endsWith(".date")) {
    return "INVALID_DATE";
  }
  if (
    path.endsWith(".allocation") ||
    path.endsWith(".lowBalanceThreshold") ||
    path.endsWith(".creditsUsed") ||
    path.endsWith(".current") ||
    path.endsWith(".creditDelta") ||
    path.endsWith(".burnMultiplier")
  ) {
    return "INVALID_DECIMAL";
  }
  return "INVALID_VALUE";
};

const toValidationIssue = (schemaIssue: RawSchemaIssue): ValidationIssue => {
  const path = pathToString(schemaIssue.path);
  const unknownKeys = schemaIssue.keys?.join(", ");
  return {
    code: schemaIssueCode(schemaIssue),
    path,
    message:
      unknownKeys === undefined
        ? schemaIssue.message
        : `${schemaIssue.message}: ${unknownKeys}`,
  };
};

export class ForecastValidationError extends Error {
  readonly schemaVersion: string | null;
  readonly methodologyVersion: string | null;
  readonly code = "INVALID_INPUT" as const;
  readonly issues: readonly ValidationIssue[];

  constructor(failure: ForecastValidationFailure) {
    super("Forecast input validation failed");
    this.name = "ForecastValidationError";
    this.schemaVersion = failure.schemaVersion;
    this.methodologyVersion = failure.methodologyVersion;
    this.issues = failure.issues;
  }

  toJSON(): ForecastValidationFailure {
    return {
      schemaVersion: this.schemaVersion,
      methodologyVersion: this.methodologyVersion,
      code: this.code,
      issues: this.issues,
    };
  }
}

export const parseAndValidateForecastInput = (input: unknown): ForecastInput => {
  const parsed = ForecastInputSchema.safeParse(input);
  if (parsed.success) {
    return parsed.data;
  }

  throw new ForecastValidationError({
    schemaVersion: portableVersion(input, "schemaVersion"),
    methodologyVersion: portableVersion(input, "methodologyVersion"),
    code: "INVALID_INPUT",
    issues: parsed.error.issues.map((issue) => toValidationIssue(issue as RawSchemaIssue)),
  });
};
