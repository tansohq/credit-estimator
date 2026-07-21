import type { ForecastInput } from "@tansohq/credit-forecast-schema";

export interface ForecastDraft {
  readonly currentBalance: string;
  readonly dailyUsage: string;
  readonly periodAllocation: string;
  readonly lowBalanceThreshold: string;
  readonly scheduledChange: string;
}

export interface ForecastPreset {
  readonly key: "on-track" | "watch" | "at-risk";
  readonly label: string;
  readonly description: string;
  readonly draft: ForecastDraft;
}

export const forecastPresets: readonly ForecastPreset[] = [
  {
    key: "on-track",
    label: "On track",
    description: "Healthy runway at the current burn rate.",
    draft: {
      currentBalance: "2000",
      dailyUsage: "35",
      periodAllocation: "2500",
      lowBalanceThreshold: "250",
      scheduledChange: "0",
    },
  },
  {
    key: "watch",
    label: "Watch closely",
    description: "Base case finishes low; high usage depletes.",
    draft: {
      currentBalance: "1100",
      dailyUsage: "40",
      periodAllocation: "2000",
      lowBalanceThreshold: "200",
      scheduledChange: "0",
    },
  },
  {
    key: "at-risk",
    label: "At risk",
    description: "Current runway does not cover the cycle.",
    draft: {
      currentBalance: "600",
      dailyUsage: "45",
      periodAllocation: "1800",
      lowBalanceThreshold: "180",
      scheduledChange: "0",
    },
  },
];

const observedDates = [
  "2026-04-01",
  "2026-04-02",
  "2026-04-03",
  "2026-04-04",
  "2026-04-05",
  "2026-04-06",
  "2026-04-07",
] as const;

export function buildForecastInput(draft: ForecastDraft): ForecastInput {
  return {
    schemaVersion: "1.0",
    methodologyVersion: "1.0",
    asOf: "2026-04-08",
    period: {
      startDate: "2026-04-01",
      endDate: "2026-05-01",
      allocation: draft.periodAllocation,
      lowBalanceThreshold: draft.lowBalanceThreshold,
    },
    lookbackDays: observedDates.length,
    dailyUsage: observedDates.map((date) => ({
      date,
      creditsUsed: draft.dailyUsage,
    })),
    balance: {
      current: draft.currentBalance,
      schedule:
        draft.scheduledChange === "0"
          ? []
          : [
              {
                date: "2026-04-15",
                creditDelta: draft.scheduledChange,
                reason: "Host-supplied scheduled change",
              },
            ],
    },
    scenarios: [
      { key: "low", burnMultiplier: "0.7" },
      { key: "base", burnMultiplier: "1" },
      { key: "high", burnMultiplier: "1.35" },
    ],
    extensions: {
      "demo.reference": {
        productKey: "sample-product",
        segmentKey: "growth",
      },
    },
  };
}
