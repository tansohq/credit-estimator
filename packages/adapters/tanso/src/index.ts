import {
  DecimalStringSchema,
  ForecastInputSchema,
  ISODateSchema,
  type DecimalString,
  type ForecastInput,
  type ISODate,
} from "@tanso-hq/credit-forecast-schema";
import { z } from "zod";

export interface TansoForecastSnapshot {
  readonly sourceSchemaVersion: "1.0";
  readonly asOf: ISODate;
  readonly currentBalance: DecimalString;
  readonly dailyUsage: readonly {
    readonly date: ISODate;
    readonly creditsUsed: DecimalString;
  }[];
}

export interface TansoForecastAssumptions {
  readonly schemaVersion: string;
  readonly methodologyVersion: string;
  readonly period: {
    readonly startDate: ISODate;
    readonly endDate: ISODate;
    readonly allocation: DecimalString;
    readonly lowBalanceThreshold: DecimalString;
  };
  readonly lookbackDays: number;
  readonly scheduledBalanceDeltas: readonly {
    readonly date: ISODate;
    readonly creditDelta: DecimalString;
    readonly reason?: string | undefined;
  }[];
  readonly scenarioMultipliers: {
    readonly low: DecimalString;
    readonly base: DecimalString;
    readonly high: DecimalString;
  };
}

export interface TansoMappingIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface TansoMappingFailure {
  readonly code: "TANSO_MAPPING_FAILED";
  readonly issues: readonly TansoMappingIssue[];
}

interface RawSchemaIssue {
  readonly code: string;
  readonly path: readonly (string | number)[];
  readonly message: string;
  readonly params?: { readonly forecastCode?: unknown };
  readonly received?: unknown;
  readonly keys?: readonly string[];
}

const DailyUsageSchema = z
  .object({
    date: ISODateSchema,
    creditsUsed: DecimalStringSchema,
  })
  .strict();

const ScheduledBalanceDeltaSchema = z
  .object({
    date: ISODateSchema,
    creditDelta: DecimalStringSchema,
    reason: z.string().min(1).optional(),
  })
  .strict();

const TansoForecastSnapshotSchema: z.ZodType<TansoForecastSnapshot> = z
  .object({
    sourceSchemaVersion: z.literal("1.0"),
    asOf: ISODateSchema,
    currentBalance: DecimalStringSchema,
    dailyUsage: z.array(DailyUsageSchema),
  })
  .strict();

const TansoForecastAssumptionsSchema: z.ZodType<TansoForecastAssumptions> = z
  .object({
    schemaVersion: z.string().min(1),
    methodologyVersion: z.string().min(1),
    period: z
      .object({
        startDate: ISODateSchema,
        endDate: ISODateSchema,
        allocation: DecimalStringSchema,
        lowBalanceThreshold: DecimalStringSchema,
      })
      .strict(),
    lookbackDays: z.number().int(),
    scheduledBalanceDeltas: z.array(ScheduledBalanceDeltaSchema),
    scenarioMultipliers: z
      .object({
        low: DecimalStringSchema,
        base: DecimalStringSchema,
        high: DecimalStringSchema,
      })
      .strict(),
  })
  .strict();

const pathToString = (
  prefix: "snapshot" | "assumptions",
  path: readonly (string | number)[],
): string =>
  path.reduce<string>(
    (result, segment) =>
      typeof segment === "number" ? `${result}[${segment}]` : `${result}.${segment}`,
    prefix,
  );

const localIssueCode = (issue: RawSchemaIssue, path: string): string => {
  if (issue.code === "invalid_type" && issue.received === "undefined") {
    return "REQUIRED_FIELD";
  }
  if (issue.code === "unrecognized_keys") {
    return "UNRECOGNIZED_FIELD";
  }
  if (path === "snapshot.sourceSchemaVersion") {
    return "UNSUPPORTED_SOURCE_SCHEMA_VERSION";
  }
  if (path.endsWith(".asOf") || path.endsWith("Date") || path.endsWith(".date")) {
    return "INVALID_DATE";
  }
  if (
    path.endsWith(".currentBalance") ||
    path.endsWith(".creditsUsed") ||
    path.endsWith(".allocation") ||
    path.endsWith(".lowBalanceThreshold") ||
    path.endsWith(".creditDelta") ||
    path.endsWith(".low") ||
    path.endsWith(".base") ||
    path.endsWith(".high")
  ) {
    return "INVALID_DECIMAL";
  }
  return "INVALID_VALUE";
};

const localIssues = (
  prefix: "snapshot" | "assumptions",
  issues: readonly RawSchemaIssue[],
): readonly TansoMappingIssue[] =>
  issues.map((issue) => {
    const path = pathToString(prefix, issue.path);
    const unknownKeys = issue.keys?.join(", ");
    return {
      code: localIssueCode(issue, path),
      path,
      message:
        unknownKeys === undefined ? issue.message : `${issue.message}: ${unknownKeys}`,
    };
  });

const scenarioKeys = ["low", "base", "high"] as const;

const forecastIssuePath = (path: readonly (string | number)[]): string => {
  const [root, second, third] = path;
  if (root === "schemaVersion") return "assumptions.schemaVersion";
  if (root === "methodologyVersion") return "assumptions.methodologyVersion";
  if (root === "asOf") return "snapshot.asOf";
  if (root === "period") {
    return pathToString("assumptions", path);
  }
  if (root === "lookbackDays") return "assumptions.lookbackDays";
  if (root === "dailyUsage") {
    return pathToString("snapshot", path);
  }
  if (root === "balance" && second === "current") return "snapshot.currentBalance";
  if (root === "balance" && second === "schedule") {
    return pathToString("assumptions", ["scheduledBalanceDeltas", ...path.slice(2)]);
  }
  if (root === "scenarios") {
    if (typeof second === "number" && third === "burnMultiplier") {
      const scenarioKey = scenarioKeys[second];
      if (scenarioKey !== undefined) {
        return `assumptions.scenarioMultipliers.${scenarioKey}`;
      }
    }
    return "assumptions.scenarioMultipliers";
  }
  return "assumptions";
};

const forecastIssues = (issues: readonly RawSchemaIssue[]): readonly TansoMappingIssue[] =>
  issues.map((issue) => ({
    code:
      typeof issue.params?.forecastCode === "string"
        ? issue.params.forecastCode
        : "INVALID_FORECAST_INPUT",
    path: forecastIssuePath(issue.path),
    message: issue.message,
  }));

export class TansoMappingError extends Error {
  readonly code = "TANSO_MAPPING_FAILED" as const;
  readonly issues: readonly TansoMappingIssue[];

  constructor(issues: readonly TansoMappingIssue[]) {
    super("Tanso snapshot mapping failed");
    this.name = "TansoMappingError";
    this.issues = issues;
  }

  toJSON(): TansoMappingFailure {
    return {
      code: this.code,
      issues: this.issues,
    };
  }
}

export function mapTansoSnapshotToForecastInput(
  snapshot: TansoForecastSnapshot,
  assumptions: TansoForecastAssumptions,
): ForecastInput;
export function mapTansoSnapshotToForecastInput(
  snapshot: unknown,
  assumptions: unknown,
): ForecastInput {
  const parsedSnapshot = TansoForecastSnapshotSchema.safeParse(snapshot);
  const parsedAssumptions = TansoForecastAssumptionsSchema.safeParse(assumptions);

  if (!parsedSnapshot.success || !parsedAssumptions.success) {
    const issues = [
      ...(!parsedSnapshot.success
        ? localIssues("snapshot", parsedSnapshot.error.issues as readonly RawSchemaIssue[])
        : []),
      ...(!parsedAssumptions.success
        ? localIssues("assumptions", parsedAssumptions.error.issues as readonly RawSchemaIssue[])
        : []),
    ];
    throw new TansoMappingError(issues);
  }

  const candidate = {
    schemaVersion: parsedAssumptions.data.schemaVersion,
    methodologyVersion: parsedAssumptions.data.methodologyVersion,
    asOf: parsedSnapshot.data.asOf,
    period: {
      startDate: parsedAssumptions.data.period.startDate,
      endDate: parsedAssumptions.data.period.endDate,
      allocation: parsedAssumptions.data.period.allocation,
      lowBalanceThreshold: parsedAssumptions.data.period.lowBalanceThreshold,
    },
    lookbackDays: parsedAssumptions.data.lookbackDays,
    dailyUsage: parsedSnapshot.data.dailyUsage.map((entry) => ({
      date: entry.date,
      creditsUsed: entry.creditsUsed,
    })),
    balance: {
      current: parsedSnapshot.data.currentBalance,
      schedule: parsedAssumptions.data.scheduledBalanceDeltas.map((entry) => ({
        date: entry.date,
        creditDelta: entry.creditDelta,
        ...(entry.reason === undefined ? {} : { reason: entry.reason }),
      })),
    },
    scenarios: [
      { key: "low", burnMultiplier: parsedAssumptions.data.scenarioMultipliers.low },
      { key: "base", burnMultiplier: parsedAssumptions.data.scenarioMultipliers.base },
      { key: "high", burnMultiplier: parsedAssumptions.data.scenarioMultipliers.high },
    ],
  } as const;

  const parsedForecast = ForecastInputSchema.safeParse(candidate);
  if (!parsedForecast.success) {
    throw new TansoMappingError(
      forecastIssues(parsedForecast.error.issues as readonly RawSchemaIssue[]),
    );
  }

  return parsedForecast.data;
}
