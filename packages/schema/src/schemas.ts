import { z } from "zod";

import type {
  CalculationTrace,
  ForecastInput,
  ForecastResult,
  ForecastValidationFailure,
  ForecastWarning,
  JsonValue,
  PlanInput,
  PlanResult,
  PlanWarning,
  ValidationIssue,
} from "./types.js";
import {
  validateForecastInputSemantics,
  validateForecastResultSemantics,
  validatePlanInputSemantics,
  validatePlanResultSemantics,
} from "./validation.js";

const CANONICAL_DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d{0,11}[1-9])?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isLeapYear = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const isCalendarDate = (value: string): boolean => {
  if (!ISO_DATE.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= (daysInMonth[month - 1] ?? 0);
};

export const DecimalStringSchema = z
  .string()
  .refine((value) => CANONICAL_DECIMAL.test(value) && value !== "-0", {
    message: "must be a canonical base-10 decimal string with at most 12 fractional digits",
  });

export const ISODateSchema = z
  .string()
  .refine(isCalendarDate, { message: "must be an ISO 8601 date-only string in YYYY-MM-DD form" });

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ]),
);

const NamespacedExtensionsSchema = z.record(JsonValueSchema);

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

const ForecastScenarioSchema = z
  .object({
    key: z.enum(["low", "base", "high"]),
    burnMultiplier: DecimalStringSchema,
  })
  .strict();

const ForecastInputStructureSchema: z.ZodType<ForecastInput> = z
  .object({
    schemaVersion: z.string().min(1),
    methodologyVersion: z.string().min(1),
    asOf: ISODateSchema,
    period: z
      .object({
        startDate: ISODateSchema,
        endDate: ISODateSchema,
        allocation: DecimalStringSchema,
        lowBalanceThreshold: DecimalStringSchema,
      })
      .strict(),
    lookbackDays: z.number().int(),
    dailyUsage: z.array(DailyUsageSchema),
    balance: z
      .object({
        current: DecimalStringSchema,
        schedule: z.array(ScheduledBalanceDeltaSchema),
      })
      .strict(),
    scenarios: z.array(ForecastScenarioSchema),
    extensions: NamespacedExtensionsSchema.optional(),
  })
  .strict();

const pathFromInputPath = (path: string): (string | number)[] => {
  const segments: (string | number)[] = [];
  const withoutPrefix = path.replace(/^(?:input|result)\./u, "");
  for (const match of withoutPrefix.matchAll(/([^.[\]]+)|\[(\d+)\]/g)) {
    const [, property, index] = match;
    segments.push(index === undefined ? (property ?? "") : Number(index));
  }
  return segments;
};

export const ForecastInputSchema: z.ZodType<ForecastInput> = ForecastInputStructureSchema.superRefine(
  (input, context) => {
    validateForecastInputSemantics(input).forEach((issue) => {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: pathFromInputPath(issue.path),
        message: issue.message,
        params: { forecastCode: issue.code },
      });
    });
  },
);

const ObservedPointSchema = z
  .object({
    date: ISODateSchema,
    creditsUsed: DecimalStringSchema,
    cumulativeCreditsUsed: DecimalStringSchema,
  })
  .strict();

const ProjectedPointSchema = z
  .object({
    date: ISODateSchema,
    startBalance: DecimalStringSchema,
    balanceDelta: DecimalStringSchema,
    creditsUsed: DecimalStringSchema,
    endingBalance: DecimalStringSchema,
  })
  .strict();

const ScenarioForecastSchema = z
  .object({
    key: z.enum(["low", "base", "high"]),
    dailyBurn: DecimalStringSchema,
    projectedCreditsUsed: DecimalStringSchema,
    projectedPeriodConsumption: DecimalStringSchema,
    utilization: DecimalStringSchema,
    endingBalance: DecimalStringSchema,
    depletionDate: ISODateSchema.nullable(),
    shortfall: DecimalStringSchema,
    status: z.enum(["ON_TRACK", "LOW_BALANCE_PROJECTED", "DEPLETION_PROJECTED"]),
    points: z.array(ProjectedPointSchema),
  })
  .strict();

const LowBalanceWarningSchema = z
  .object({
    code: z.literal("LOW_BALANCE_PROJECTED"),
    scenarioKey: z.enum(["low", "base", "high"]),
    endingBalance: DecimalStringSchema,
    threshold: DecimalStringSchema,
  })
  .strict();

const DepletionWarningSchema = z
  .object({
    code: z.literal("DEPLETION_PROJECTED"),
    scenarioKey: z.enum(["low", "base", "high"]),
    depletionDate: ISODateSchema,
    shortfall: DecimalStringSchema,
  })
  .strict();

export const ForecastWarningSchema = z.discriminatedUnion("code", [
  LowBalanceWarningSchema,
  DepletionWarningSchema,
]);

const SourceInputTraceSchema = z
  .object({
    path: z.string().min(1),
    value: JsonValueSchema,
  })
  .strict();

const CalculationStepSchema = z
  .object({
    key: z.string().min(1),
    formula: z.string().min(1),
    operands: z.record(JsonValueSchema),
    result: JsonValueSchema,
  })
  .strict();

export const CalculationTraceSchema: z.ZodType<CalculationTrace> = z
  .object({
    sourceInputs: z.array(SourceInputTraceSchema).min(1),
    steps: z.array(CalculationStepSchema).min(1),
  })
  .strict();

const ForecastResultStructureSchema: z.ZodType<ForecastResult> = z
  .object({
    schemaVersion: z.string().min(1),
    methodologyVersion: z.string().min(1),
    asOf: ISODateSchema,
    daysRemaining: z.number().int().positive(),
    creditsUsedToDate: DecimalStringSchema,
    baselineDailyBurn: DecimalStringSchema,
    observedPoints: z.array(ObservedPointSchema),
    scenarios: z.array(ScenarioForecastSchema).length(3),
    warnings: z.array(ForecastWarningSchema),
    calculationTrace: CalculationTraceSchema,
  })
  .strict();

export const ForecastResultSchema: z.ZodType<ForecastResult> =
  ForecastResultStructureSchema.superRefine((result, context) => {
    validateForecastResultSemantics(result).forEach((issue) => {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: pathFromInputPath(issue.path),
        message: issue.message,
        params: { forecastCode: issue.code },
      });
    });
  });

export const ValidationIssueSchema: z.ZodType<ValidationIssue> = z
  .object({
    code: z.string().min(1),
    path: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

export const ForecastValidationFailureSchema: z.ZodType<ForecastValidationFailure> = z
  .object({
    schemaVersion: z.string().min(1).nullable(),
    methodologyVersion: z.string().min(1).nullable(),
    code: z.literal("INVALID_INPUT"),
    issues: z.array(ValidationIssueSchema).min(1),
  })
  .strict();

const PlanMetricEstimateSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1).optional(),
    estimatedUnits: DecimalStringSchema,
    creditsPerUnit: DecimalStringSchema,
  })
  .strict();

const PlanInputStructureSchema: z.ZodType<PlanInput> = z
  .object({
    schemaVersion: z.string().min(1),
    methodologyVersion: z.string().min(1),
    period: z
      .object({
        startDate: ISODateSchema,
        endDate: ISODateSchema,
      })
      .strict(),
    metricEstimates: z.array(PlanMetricEstimateSchema),
    allocation: DecimalStringSchema.optional(),
    scenarios: z.array(ForecastScenarioSchema),
    extensions: NamespacedExtensionsSchema.optional(),
  })
  .strict();

export const PlanInputSchema: z.ZodType<PlanInput> = PlanInputStructureSchema.superRefine(
  (input, context) => {
    validatePlanInputSemantics(input).forEach((issue) => {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: pathFromInputPath(issue.path),
        message: issue.message,
        params: { forecastCode: issue.code },
      });
    });
  },
);

const PlanMetricCreditsSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1).optional(),
    estimatedUnits: DecimalStringSchema,
    creditsPerUnit: DecimalStringSchema,
    plannedCredits: DecimalStringSchema,
  })
  .strict();

const PlanScenarioMetricCreditsSchema = z
  .object({
    key: z.string().min(1),
    plannedCredits: DecimalStringSchema,
  })
  .strict();

const PlanAllocationComparisonSchema = z
  .object({
    allocation: DecimalStringSchema,
    utilization: DecimalStringSchema,
    surplus: DecimalStringSchema,
    shortfall: DecimalStringSchema,
    status: z.enum(["WITHIN_ALLOCATION", "OVER_ALLOCATION"]),
  })
  .strict();

const ScenarioPlanSchema = z
  .object({
    key: z.enum(["low", "base", "high"]),
    burnMultiplier: DecimalStringSchema,
    plannedCredits: DecimalStringSchema,
    averageDailyBurn: DecimalStringSchema,
    metricBreakdown: z.array(PlanScenarioMetricCreditsSchema),
    comparison: PlanAllocationComparisonSchema.nullable(),
  })
  .strict();

export const PlanWarningSchema: z.ZodType<PlanWarning> = z
  .object({
    code: z.literal("OVER_ALLOCATION"),
    scenarioKey: z.enum(["low", "base", "high"]),
    plannedCredits: DecimalStringSchema,
    allocation: DecimalStringSchema,
    shortfall: DecimalStringSchema,
  })
  .strict();

const PlanResultStructureSchema: z.ZodType<PlanResult> = z
  .object({
    schemaVersion: z.string().min(1),
    methodologyVersion: z.string().min(1),
    daysInPeriod: z.number().int().positive(),
    baselinePlannedCredits: DecimalStringSchema,
    baselineAverageDailyBurn: DecimalStringSchema,
    metrics: z.array(PlanMetricCreditsSchema),
    scenarios: z.array(ScenarioPlanSchema).length(3),
    warnings: z.array(PlanWarningSchema),
    calculationTrace: CalculationTraceSchema,
  })
  .strict();

export const PlanResultSchema: z.ZodType<PlanResult> =
  PlanResultStructureSchema.superRefine((result, context) => {
    validatePlanResultSemantics(result).forEach((issue) => {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: pathFromInputPath(issue.path),
        message: issue.message,
        params: { forecastCode: issue.code },
      });
    });
  });

export const parseForecastInput = (input: unknown): ForecastInput => ForecastInputSchema.parse(input);

export const parseForecastResult = (result: unknown): ForecastResult => ForecastResultSchema.parse(result);

export const parsePlanInput = (input: unknown): PlanInput => PlanInputSchema.parse(input);

export const parsePlanResult = (result: unknown): PlanResult => PlanResultSchema.parse(result);
