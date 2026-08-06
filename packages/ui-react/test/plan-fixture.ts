import type {
  PlanInput,
  PlanResult,
} from "@tansohq/credit-forecast-schema";

export const planInput: PlanInput = {
  schemaVersion: "1.0",
  methodologyVersion: "1.0",
  period: { startDate: "2026-02-01", endDate: "2026-03-01" },
  metricEstimates: [
    { key: "api-calls", label: "API calls", estimatedUnits: "1000", creditsPerUnit: "0.5" },
    { key: "reports", label: "Generated reports", estimatedUnits: "20", creditsPerUnit: "5" },
  ],
  allocation: "700",
  scenarios: [
    { key: "low", burnMultiplier: "0.8" },
    { key: "base", burnMultiplier: "1" },
    { key: "high", burnMultiplier: "1.25" },
  ],
};

export const planResult: PlanResult = {
  schemaVersion: "1.0",
  methodologyVersion: "1.0",
  daysInPeriod: 28,
  baselinePlannedCredits: "600",
  baselineAverageDailyBurn: "21.428571428571",
  metrics: [
    { key: "api-calls", label: "API calls", estimatedUnits: "1000", creditsPerUnit: "0.5", plannedCredits: "500" },
    { key: "reports", label: "Generated reports", estimatedUnits: "20", creditsPerUnit: "5", plannedCredits: "100" },
  ],
  scenarios: [
    {
      key: "low",
      burnMultiplier: "0.8",
      plannedCredits: "480",
      averageDailyBurn: "17.142857142857",
      metricBreakdown: [
        { key: "api-calls", plannedCredits: "400" },
        { key: "reports", plannedCredits: "80" },
      ],
      comparison: {
        allocation: "700",
        utilization: "0.685714285714",
        surplus: "220",
        shortfall: "0",
        status: "WITHIN_ALLOCATION",
      },
    },
    {
      key: "base",
      burnMultiplier: "1",
      plannedCredits: "600",
      averageDailyBurn: "21.428571428571",
      metricBreakdown: [
        { key: "api-calls", plannedCredits: "500" },
        { key: "reports", plannedCredits: "100" },
      ],
      comparison: {
        allocation: "700",
        utilization: "0.857142857143",
        surplus: "100",
        shortfall: "0",
        status: "WITHIN_ALLOCATION",
      },
    },
    {
      key: "high",
      burnMultiplier: "1.25",
      plannedCredits: "750",
      averageDailyBurn: "26.785714285714",
      metricBreakdown: [
        { key: "api-calls", plannedCredits: "625" },
        { key: "reports", plannedCredits: "125" },
      ],
      comparison: {
        allocation: "700",
        utilization: "1.071428571429",
        surplus: "0",
        shortfall: "50",
        status: "OVER_ALLOCATION",
      },
    },
  ],
  warnings: [
    {
      code: "OVER_ALLOCATION",
      scenarioKey: "high",
      plannedCredits: "750",
      allocation: "700",
      shortfall: "50",
    },
  ],
  calculationTrace: {
    sourceInputs: [
      { path: "input.allocation", value: "700" },
      {
        path: "input.metricEstimates",
        value: [
          { key: "api-calls", label: "API calls", estimatedUnits: "1000", creditsPerUnit: "0.5" },
          { key: "reports", label: "Generated reports", estimatedUnits: "20", creditsPerUnit: "5" },
        ],
      },
    ],
    steps: [
      {
        key: "baselinePlannedCredits",
        formula: "sum(metrics[*].plannedCredits)",
        operands: { metricPlannedCredits: ["500", "100"] },
        result: "600",
      },
      {
        key: "daysInPeriod",
        formula: "calendar_days_in_[period.startDate,period.endDate)",
        operands: { periodStartDate: "2026-02-01", periodEndDate: "2026-03-01" },
        result: 28,
      },
    ],
  },
};

const withoutAllocation = ({ allocation: _allocation, ...rest }: PlanInput): PlanInput => rest;

export const estimateOnlyPlanInput: PlanInput = withoutAllocation({
  ...planInput,
});

export const estimateOnlyPlanResult: PlanResult = {
  ...planResult,
  scenarios: planResult.scenarios.map((scenario) => ({
    ...scenario,
    comparison: null,
  })),
  warnings: [],
};
