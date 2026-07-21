import { describe, expect, it } from "vitest";

import {
  DecimalStringSchema,
  ForecastInputSchema,
  ForecastResultSchema,
  ForecastValidationFailureSchema,
  ISODateSchema,
  areForecastVersionsCompatible,
  validateForecastInputSemantics,
  type ForecastInput,
  type ForecastResult,
} from "../src/index.js";

const validInput: ForecastInput = {
  schemaVersion: "1.0",
  methodologyVersion: "1.0",
  asOf: "2026-01-02",
  period: {
    startDate: "2026-01-01",
    endDate: "2026-01-04",
    allocation: "100",
    lowBalanceThreshold: "10",
  },
  lookbackDays: 1,
  dailyUsage: [{ date: "2026-01-01", creditsUsed: "10" }],
  balance: { current: "50", schedule: [] },
  scenarios: [
    { key: "low", burnMultiplier: "0.5" },
    { key: "base", burnMultiplier: "1" },
    { key: "high", burnMultiplier: "1.5" },
  ],
};

const validResult: ForecastResult = {
  schemaVersion: "1.0",
  methodologyVersion: "1.0",
  asOf: "2026-01-02",
  daysRemaining: 2,
  creditsUsedToDate: "10",
  baselineDailyBurn: "10",
  observedPoints: [
    { date: "2026-01-01", creditsUsed: "10", cumulativeCreditsUsed: "10" },
  ],
  scenarios: [
    {
      key: "low",
      dailyBurn: "5",
      projectedCreditsUsed: "10",
      projectedPeriodConsumption: "20",
      utilization: "0.2",
      endingBalance: "40",
      depletionDate: null,
      shortfall: "0",
      status: "ON_TRACK",
      points: [
        { date: "2026-01-02", startBalance: "50", balanceDelta: "0", creditsUsed: "5", endingBalance: "45" },
        { date: "2026-01-03", startBalance: "45", balanceDelta: "0", creditsUsed: "5", endingBalance: "40" },
      ],
    },
    {
      key: "base",
      dailyBurn: "10",
      projectedCreditsUsed: "20",
      projectedPeriodConsumption: "30",
      utilization: "0.3",
      endingBalance: "30",
      depletionDate: null,
      shortfall: "0",
      status: "ON_TRACK",
      points: [
        { date: "2026-01-02", startBalance: "50", balanceDelta: "0", creditsUsed: "10", endingBalance: "40" },
        { date: "2026-01-03", startBalance: "40", balanceDelta: "0", creditsUsed: "10", endingBalance: "30" },
      ],
    },
    {
      key: "high",
      dailyBurn: "15",
      projectedCreditsUsed: "30",
      projectedPeriodConsumption: "40",
      utilization: "0.4",
      endingBalance: "20",
      depletionDate: null,
      shortfall: "0",
      status: "ON_TRACK",
      points: [
        { date: "2026-01-02", startBalance: "50", balanceDelta: "0", creditsUsed: "15", endingBalance: "35" },
        { date: "2026-01-03", startBalance: "35", balanceDelta: "0", creditsUsed: "15", endingBalance: "20" },
      ],
    },
  ],
  warnings: [],
  calculationTrace: {
    sourceInputs: [{ path: "input.balance.current", value: "50" }],
    steps: [
      {
        key: "baselineDailyBurn",
        formula: "sum(lookbackCreditsUsed) / lookbackDays",
        operands: { lookbackCreditsUsed: ["10"], lookbackDays: 1 },
        result: "10",
      },
    ],
  },
};

describe("portable scalar schemas", () => {
  it.each(["0", "1", "-1", "0.5", "-0.5", "123456789.123456789012"])(
    "accepts canonical decimal %s",
    (value) => {
      expect(DecimalStringSchema.safeParse(value).success).toBe(true);
    },
  );

  it.each([0, Number.NaN, "01", "+1", "1.0", "-0", "1e3", "0.1234567890123"])(
    "rejects non-canonical decimal %s",
    (value) => {
      expect(DecimalStringSchema.safeParse(value).success).toBe(false);
    },
  );

  it.each(["2024-02-29", "2026-12-31"])("accepts date %s", (value) => {
    expect(ISODateSchema.safeParse(value).success).toBe(true);
  });

  it.each(["2023-02-29", "2026-02-30", "2026-1-01", "2026-01-01T00:00:00Z"])(
    "rejects date %s",
    (value) => {
      expect(ISODateSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("neutral contracts", () => {
  it("does not silently default required fields", () => {
    expect(ForecastInputSchema.safeParse({}).success).toBe(false);
  });

  it("validates the structured failure envelope", () => {
    expect(
      ForecastValidationFailureSchema.parse({
        schemaVersion: "1.0",
        methodologyVersion: "1.0",
        code: "INVALID_INPUT",
        issues: [{ code: "INVALID_DATE", path: "input.asOf", message: "invalid date" }],
      }),
    ).toBeDefined();
  });

  it("compares both portable versions", () => {
    const input = { schemaVersion: "1.0", methodologyVersion: "1.0" };
    expect(areForecastVersionsCompatible(input, input)).toBe(true);
    expect(
      areForecastVersionsCompatible(input, {
        schemaVersion: "1.0",
        methodologyVersion: "2.0",
      }),
    ).toBe(false);
  });

  it("rejects malformed extension namespaces", () => {
    for (const namespace of [".", ".product", "product.", "product"]) {
      const input = { ...validInput, extensions: { [namespace]: {} } };
      expect(ForecastInputSchema.safeParse(input).success, namespace).toBe(false);
    }
    expect(
      ForecastInputSchema.safeParse({
        ...validInput,
        extensions: { "com.example": {} },
      }).success,
    ).toBe(true);
  });

  it("reports nonadjacent duplicate and missing history dates", () => {
    const input: ForecastInput = {
      ...validInput,
      asOf: "2026-01-06",
      period: { ...validInput.period, endDate: "2026-01-07" },
      dailyUsage: [
        { date: "2026-01-01", creditsUsed: "1" },
        { date: "2026-01-02", creditsUsed: "1" },
        { date: "2026-01-01", creditsUsed: "1" },
        { date: "2026-01-04", creditsUsed: "1" },
        { date: "2026-01-05", creditsUsed: "1" },
      ],
    };
    const codes = validateForecastInputSemantics(input).map(({ code }) => code);

    expect(codes).toContain("DUPLICATE_DAILY_USAGE_DATE");
    expect(codes).toContain("UNORDERED_DAILY_HISTORY");
    expect(codes).toContain("INCOMPLETE_DAILY_HISTORY");
  });

  it("rejects internally inconsistent forecast results", () => {
    const corrupt: ForecastResult = {
      ...validResult,
      schemaVersion: "2.0",
      creditsUsedToDate: "-1",
      baselineDailyBurn: "-999",
      scenarios: validResult.scenarios.map((scenario) =>
        scenario.key === "base"
          ? {
              ...scenario,
              projectedCreditsUsed: "-12",
              points: [],
              depletionDate: null,
              shortfall: "3",
              status: "DEPLETION_PROJECTED" as const,
            }
          : scenario,
      ),
    };

    const parsed = ForecastResultSchema.safeParse(corrupt);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const codes = parsed.error.issues.map(
        (issue) =>
          (issue as { readonly params?: { readonly forecastCode?: unknown } }).params
            ?.forecastCode,
      );
      expect(codes).toContain("UNSUPPORTED_SCHEMA_VERSION");
      expect(codes).toContain("NEGATIVE_RESULT_VALUE");
      expect(codes).toContain("INVALID_PROJECTED_POINT_COUNT");
      expect(codes).toContain("STATUS_DEPLETION_MISMATCH");
      expect(codes).toContain("SHORTFALL_MISMATCH");
      expect(codes).toContain("CREDITS_USED_TO_DATE_MISMATCH");
      expect(codes).toContain("PROJECTED_CREDITS_USED_MISMATCH");
    }
  });

  it("rejects arithmetic corruption in otherwise valid results", () => {
    const corrupt: ForecastResult = {
      ...validResult,
      observedPoints: validResult.observedPoints.map((point) => ({
        ...point,
        cumulativeCreditsUsed: "9",
      })),
      scenarios: validResult.scenarios.map((scenario) =>
        scenario.key === "base"
          ? {
              ...scenario,
              projectedCreditsUsed: "21",
              projectedPeriodConsumption: "31",
              points: scenario.points.map((point, index) =>
                index === 1
                  ? { ...point, startBalance: "39", endingBalance: "15" }
                  : point,
              ),
              endingBalance: "15",
            }
          : scenario,
      ),
    };

    const parsed = ForecastResultSchema.safeParse(corrupt);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const codes = parsed.error.issues.map(
        (issue) =>
          (issue as { readonly params?: { readonly forecastCode?: unknown } }).params
            ?.forecastCode,
      );
      expect(codes).toContain("OBSERVED_CUMULATIVE_MISMATCH");
      expect(codes).toContain("PROJECTED_CREDITS_USED_MISMATCH");
      expect(codes).toContain("PROJECTED_BALANCE_CONTINUITY_MISMATCH");
      expect(codes).toContain("INVALID_SCENARIO_RESULT_ORDER");
    }
  });

  it("accepts a complete consistent forecast result", () => {
    expect(ForecastResultSchema.safeParse(validResult).success).toBe(true);
  });
});
