import type {
  ForecastInput,
  ForecastResult,
} from "@tansohq/credit-forecast-schema";

export const forecastInput: ForecastInput = {
  schemaVersion: "1.0",
  methodologyVersion: "1.0",
  asOf: "2026-01-03",
  period: {
    startDate: "2026-01-01",
    endDate: "2026-01-05",
    allocation: "200",
    lowBalanceThreshold: "30",
  },
  lookbackDays: 2,
  dailyUsage: [
    { date: "2026-01-01", creditsUsed: "20" },
    { date: "2026-01-02", creditsUsed: "20" },
  ],
  balance: {
    current: "100",
    schedule: [],
  },
  scenarios: [
    { key: "low", burnMultiplier: "0.5" },
    { key: "base", burnMultiplier: "1" },
    { key: "high", burnMultiplier: "1.5" },
  ],
};

export const forecastResult: ForecastResult = {
  schemaVersion: "1.0",
  methodologyVersion: "1.0",
  asOf: "2026-01-03",
  daysRemaining: 2,
  creditsUsedToDate: "40",
  baselineDailyBurn: "20",
  observedPoints: [
    { date: "2026-01-01", creditsUsed: "20", cumulativeCreditsUsed: "20" },
    { date: "2026-01-02", creditsUsed: "20", cumulativeCreditsUsed: "40" },
  ],
  scenarios: [
    {
      key: "low",
      dailyBurn: "10",
      projectedCreditsUsed: "20",
      projectedPeriodConsumption: "60",
      utilization: "0.3",
      endingBalance: "80",
      depletionDate: null,
      shortfall: "0",
      status: "ON_TRACK",
      points: [
        {
          date: "2026-01-03",
          startBalance: "100",
          balanceDelta: "0",
          creditsUsed: "10",
          endingBalance: "90",
        },
        {
          date: "2026-01-04",
          startBalance: "90",
          balanceDelta: "0",
          creditsUsed: "10",
          endingBalance: "80",
        },
      ],
    },
    {
      key: "base",
      dailyBurn: "20",
      projectedCreditsUsed: "40",
      projectedPeriodConsumption: "80",
      utilization: "0.4",
      endingBalance: "60",
      depletionDate: null,
      shortfall: "0",
      status: "ON_TRACK",
      points: [
        {
          date: "2026-01-03",
          startBalance: "100",
          balanceDelta: "0",
          creditsUsed: "20",
          endingBalance: "80",
        },
        {
          date: "2026-01-04",
          startBalance: "80",
          balanceDelta: "0",
          creditsUsed: "20",
          endingBalance: "60",
        },
      ],
    },
    {
      key: "high",
      dailyBurn: "30",
      projectedCreditsUsed: "60",
      projectedPeriodConsumption: "100",
      utilization: "0.5",
      endingBalance: "40",
      depletionDate: null,
      shortfall: "0",
      status: "ON_TRACK",
      points: [
        {
          date: "2026-01-03",
          startBalance: "100",
          balanceDelta: "0",
          creditsUsed: "30",
          endingBalance: "70",
        },
        {
          date: "2026-01-04",
          startBalance: "70",
          balanceDelta: "0",
          creditsUsed: "30",
          endingBalance: "40",
        },
      ],
    },
  ],
  warnings: [],
  calculationTrace: {
    sourceInputs: [
      { path: "input.balance.current", value: "100" },
      { path: "input.lookbackDays", value: 2 },
    ],
    steps: [
      {
        key: "baselineDailyBurn",
        formula: "sum(lookbackCreditsUsed) / lookbackDays",
        operands: { lookbackCreditsUsed: ["20", "20"], lookbackDays: 2 },
        result: "20",
      },
    ],
  },
};
