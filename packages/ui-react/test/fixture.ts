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

export const riskForecastInput: ForecastInput = {
  ...forecastInput,
  balance: {
    current: "40",
    schedule: [],
  },
};

export const riskForecastResult: ForecastResult = {
  ...forecastResult,
  scenarios: [
    {
      key: "low",
      dailyBurn: "10",
      projectedCreditsUsed: "20",
      projectedPeriodConsumption: "60",
      utilization: "0.3",
      endingBalance: "20",
      depletionDate: null,
      shortfall: "0",
      status: "LOW_BALANCE_PROJECTED",
      points: [
        {
          date: "2026-01-03",
          startBalance: "40",
          balanceDelta: "0",
          creditsUsed: "10",
          endingBalance: "30",
        },
        {
          date: "2026-01-04",
          startBalance: "30",
          balanceDelta: "0",
          creditsUsed: "10",
          endingBalance: "20",
        },
      ],
    },
    {
      key: "base",
      dailyBurn: "20",
      projectedCreditsUsed: "40",
      projectedPeriodConsumption: "80",
      utilization: "0.4",
      endingBalance: "0",
      depletionDate: "2026-01-04",
      shortfall: "0",
      status: "DEPLETION_PROJECTED",
      points: [
        {
          date: "2026-01-03",
          startBalance: "40",
          balanceDelta: "0",
          creditsUsed: "20",
          endingBalance: "20",
        },
        {
          date: "2026-01-04",
          startBalance: "20",
          balanceDelta: "0",
          creditsUsed: "20",
          endingBalance: "0",
        },
      ],
    },
    {
      key: "high",
      dailyBurn: "30",
      projectedCreditsUsed: "60",
      projectedPeriodConsumption: "100",
      utilization: "0.5",
      endingBalance: "-20",
      depletionDate: "2026-01-04",
      shortfall: "20",
      status: "DEPLETION_PROJECTED",
      points: [
        {
          date: "2026-01-03",
          startBalance: "40",
          balanceDelta: "0",
          creditsUsed: "30",
          endingBalance: "10",
        },
        {
          date: "2026-01-04",
          startBalance: "10",
          balanceDelta: "0",
          creditsUsed: "30",
          endingBalance: "-20",
        },
      ],
    },
  ],
  warnings: [
    {
      code: "LOW_BALANCE_PROJECTED",
      scenarioKey: "low",
      endingBalance: "20",
      threshold: "30",
    },
    {
      code: "DEPLETION_PROJECTED",
      scenarioKey: "base",
      depletionDate: "2026-01-04",
      shortfall: "0",
    },
    {
      code: "DEPLETION_PROJECTED",
      scenarioKey: "high",
      depletionDate: "2026-01-04",
      shortfall: "20",
    },
  ],
  calculationTrace: {
    sourceInputs: [
      { path: "input.balance.current", value: "40" },
      { path: "input.lookbackDays", value: 2 },
    ],
    steps: [
      {
        key: "baselineDailyBurn",
        formula: "sum(lookbackCreditsUsed) / lookbackDays",
        operands: { lookbackCreditsUsed: ["20", "20"], lookbackDays: 2 },
        result: "20",
      },
      {
        key: "high.points",
        formula: "endingBalance = startBalance + balanceDelta - creditsUsed",
        operands: { initialBalance: "40", dailyBurn: "30", scheduledDeltas: [] },
        result: [
          {
            date: "2026-01-03",
            startBalance: "40",
            balanceDelta: "0",
            creditsUsed: "30",
            endingBalance: "10",
          },
          {
            date: "2026-01-04",
            startBalance: "10",
            balanceDelta: "0",
            creditsUsed: "30",
            endingBalance: "-20",
          },
        ],
      },
      {
        key: "high.depletionDate",
        formula: "first date where endingBalance <= 0",
        operands: { endingBalances: ["10", "-20"] },
        result: "2026-01-04",
      },
      {
        key: "high.shortfall",
        formula: "max(0, -endingBalance)",
        operands: { endingBalance: "-20" },
        result: "20",
      },
      {
        key: "high.status",
        formula: "status_from_depletion_date_ending_balance_and_threshold",
        operands: {
          depletionDate: "2026-01-04",
          endingBalance: "-20",
          lowBalanceThreshold: "30",
        },
        result: "DEPLETION_PROJECTED",
      },
    ],
  },
};

export const zeroUsageForecastInput: ForecastInput = {
  ...forecastInput,
  dailyUsage: [
    { date: "2026-01-01", creditsUsed: "0" },
    { date: "2026-01-02", creditsUsed: "0" },
  ],
};

export const zeroUsageForecastResult: ForecastResult = {
  ...forecastResult,
  creditsUsedToDate: "0",
  baselineDailyBurn: "0",
  observedPoints: [
    { date: "2026-01-01", creditsUsed: "0", cumulativeCreditsUsed: "0" },
    { date: "2026-01-02", creditsUsed: "0", cumulativeCreditsUsed: "0" },
  ],
  scenarios: (["low", "base", "high"] as const).map((key) => ({
    key,
    dailyBurn: "0",
    projectedCreditsUsed: "0",
    projectedPeriodConsumption: "0",
    utilization: "0",
    endingBalance: "100",
    depletionDate: null,
    shortfall: "0",
    status: "ON_TRACK",
    points: [
      {
        date: "2026-01-03",
        startBalance: "100",
        balanceDelta: "0",
        creditsUsed: "0",
        endingBalance: "100",
      },
      {
        date: "2026-01-04",
        startBalance: "100",
        balanceDelta: "0",
        creditsUsed: "0",
        endingBalance: "100",
      },
    ],
  })),
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
        operands: { lookbackCreditsUsed: ["0", "0"], lookbackDays: 2 },
        result: "0",
      },
    ],
  },
};

export function timelineForecastFixture(
  observedDayCount: number,
  projectedDayCount: number,
): readonly [ForecastInput, ForecastResult] {
  const date = (day: number) => `2026-01-${String(day).padStart(2, "0")}`;
  const asOf = date(observedDayCount + 1);
  const endDate = date(observedDayCount + projectedDayCount + 1);
  const dailyUsage = Array.from({ length: observedDayCount }, (_, index) => ({
    date: date(index + 1),
    creditsUsed: "0",
  }));
  const observedPoints = dailyUsage.map(({ date: observedDate }) => ({
    date: observedDate,
    creditsUsed: "0",
    cumulativeCreditsUsed: "0",
  }));
  const projectedPoints = Array.from({ length: projectedDayCount }, (_, index) => ({
    date: date(observedDayCount + index + 1),
    startBalance: "100",
    balanceDelta: "0",
    creditsUsed: "0",
    endingBalance: "100",
  }));
  const input: ForecastInput = {
    schemaVersion: "1.0",
    methodologyVersion: "1.0",
    asOf,
    period: {
      startDate: date(1),
      endDate,
      allocation: "200",
      lowBalanceThreshold: "30",
    },
    lookbackDays: observedDayCount,
    dailyUsage,
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
  const result: ForecastResult = {
    schemaVersion: "1.0",
    methodologyVersion: "1.0",
    asOf,
    daysRemaining: projectedDayCount,
    creditsUsedToDate: "0",
    baselineDailyBurn: "0",
    observedPoints,
    scenarios: (["low", "base", "high"] as const).map((key) => ({
      key,
      dailyBurn: "0",
      projectedCreditsUsed: "0",
      projectedPeriodConsumption: "0",
      utilization: "0",
      endingBalance: "100",
      depletionDate: null,
      shortfall: "0",
      status: "ON_TRACK",
      points: projectedPoints,
    })),
    warnings: [],
    calculationTrace: {
      sourceInputs: [
        { path: "input.asOf", value: asOf },
        { path: "input.balance.current", value: "100" },
      ],
      steps: [],
    },
  };

  return [input, result];
}
