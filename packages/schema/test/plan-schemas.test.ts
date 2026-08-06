import { describe, expect, it } from "vitest";

import {
  PlanInputSchema,
  PlanResultSchema,
  validatePlanInputSemantics,
  type PlanInput,
  type PlanResult,
} from "../src/index.js";

const validInput: PlanInput = {
  schemaVersion: "1.0",
  methodologyVersion: "1.0",
  period: { startDate: "2026-01-01", endDate: "2026-01-03" },
  metricEstimates: [
    { key: "m1", estimatedUnits: "4", creditsPerUnit: "0.5" },
  ],
  allocation: "3",
  scenarios: [
    { key: "low", burnMultiplier: "0.5" },
    { key: "base", burnMultiplier: "1" },
    { key: "high", burnMultiplier: "2" },
  ],
};

const validResult: PlanResult = {
  schemaVersion: "1.0",
  methodologyVersion: "1.0",
  daysInPeriod: 2,
  baselinePlannedCredits: "2",
  baselineAverageDailyBurn: "1",
  metrics: [
    { key: "m1", estimatedUnits: "4", creditsPerUnit: "0.5", plannedCredits: "2" },
  ],
  scenarios: [
    {
      key: "low",
      burnMultiplier: "0.5",
      plannedCredits: "1",
      averageDailyBurn: "0.5",
      metricBreakdown: [{ key: "m1", plannedCredits: "1" }],
      comparison: {
        allocation: "3",
        utilization: "0.333333333333",
        surplus: "2",
        shortfall: "0",
        status: "WITHIN_ALLOCATION",
      },
    },
    {
      key: "base",
      burnMultiplier: "1",
      plannedCredits: "2",
      averageDailyBurn: "1",
      metricBreakdown: [{ key: "m1", plannedCredits: "2" }],
      comparison: {
        allocation: "3",
        utilization: "0.666666666667",
        surplus: "1",
        shortfall: "0",
        status: "WITHIN_ALLOCATION",
      },
    },
    {
      key: "high",
      burnMultiplier: "2",
      plannedCredits: "4",
      averageDailyBurn: "2",
      metricBreakdown: [{ key: "m1", plannedCredits: "4" }],
      comparison: {
        allocation: "3",
        utilization: "1.333333333333",
        surplus: "0",
        shortfall: "1",
        status: "OVER_ALLOCATION",
      },
    },
  ],
  warnings: [
    {
      code: "OVER_ALLOCATION",
      scenarioKey: "high",
      plannedCredits: "4",
      allocation: "3",
      shortfall: "1",
    },
  ],
  calculationTrace: {
    sourceInputs: [{ path: "input.schemaVersion", value: "1.0" }],
    steps: [{ key: "baselinePlannedCredits", formula: "sum", operands: {}, result: "2" }],
  },
};

type MutablePlanResult = PlanResult & {
  scenarios: {
    comparison: {
      utilization: string;
      surplus: string;
      shortfall: string;
      status: string;
      allocation: string;
    } | null;
    plannedCredits: string;
    averageDailyBurn: string;
    metricBreakdown: { key: string; plannedCredits: string }[];
  }[];
  warnings: unknown[];
  baselinePlannedCredits: string;
};

const resultFailureCodes = (mutate: (result: MutablePlanResult) => void): string[] => {
  const tampered = structuredClone(validResult) as MutablePlanResult;
  mutate(tampered);
  const parsed = PlanResultSchema.safeParse(tampered);
  expect(parsed.success).toBe(false);
  if (parsed.success) return [];
  return parsed.error.issues.map((issue) => {
    const forecastCode = (issue as { params?: { forecastCode?: unknown } }).params?.forecastCode;
    return typeof forecastCode === "string" ? forecastCode : issue.code;
  });
};

describe("plan input schema", () => {
  it("accepts a valid plan input", () => {
    expect(PlanInputSchema.safeParse(validInput).success).toBe(true);
  });

  it("accepts an input without an allocation", () => {
    const { allocation: _allocation, ...withoutAllocation } = validInput;
    expect(PlanInputSchema.safeParse(withoutAllocation).success).toBe(true);
  });

  it("flags duplicate metric keys", () => {
    const issues = validatePlanInputSemantics({
      ...validInput,
      metricEstimates: [
        { key: "m1", estimatedUnits: "1", creditsPerUnit: "1" },
        { key: "m1", estimatedUnits: "2", creditsPerUnit: "1" },
      ],
    });
    expect(issues.map(({ code }) => code)).toContain("DUPLICATE_METRIC_KEY");
  });
});

describe("plan result schema", () => {
  it("accepts a consistent plan result", () => {
    expect(PlanResultSchema.safeParse(validResult).success).toBe(true);
  });

  it("rejects a baseline that does not equal the metric sum", () => {
    expect(
      resultFailureCodes((result) => {
        result.baselinePlannedCredits = "3";
      }),
    ).toContain("BASELINE_PLANNED_CREDITS_MISMATCH");
  });

  it("rejects a scenario total that does not equal its breakdown sum", () => {
    expect(
      resultFailureCodes((result) => {
        const high = result.scenarios[2];
        if (high !== undefined) high.plannedCredits = "5";
      }),
    ).toContain("PLANNED_CREDITS_MISMATCH");
  });

  it("rejects a wrong utilization", () => {
    expect(
      resultFailureCodes((result) => {
        const comparison = result.scenarios[0]?.comparison;
        if (comparison !== null && comparison !== undefined) {
          comparison.utilization = "0.5";
        }
      }),
    ).toContain("UTILIZATION_MISMATCH");
  });

  it("rejects a status that contradicts the shortfall", () => {
    expect(
      resultFailureCodes((result) => {
        const comparison = result.scenarios[2]?.comparison;
        if (comparison !== null && comparison !== undefined) {
          comparison.status = "WITHIN_ALLOCATION";
        }
      }),
    ).toContain("STATUS_MISMATCH");
  });

  it("rejects a missing over-allocation warning", () => {
    expect(
      resultFailureCodes((result) => {
        result.warnings = [];
      }),
    ).toContain("MISSING_OVER_ALLOCATION_WARNING");
  });

  it("rejects mixed null and non-null comparisons", () => {
    expect(
      resultFailureCodes((result) => {
        const low = result.scenarios[0];
        if (low !== undefined) low.comparison = null;
      }),
    ).toContain("ALLOCATION_COMPARISON_MISMATCH");
  });
});
