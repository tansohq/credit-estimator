import { parseAndValidateForecastInput } from "@tanso-hq/credit-forecast-core";
import type {
  ForecastInput,
  NamespacedExtensions,
  ValidationIssue,
} from "@tanso-hq/credit-forecast-schema";

export interface ForecastDraft {
  readonly schemaVersion: string;
  readonly methodologyVersion: string;
  readonly periodStartDate: string;
  readonly asOf: string;
  readonly periodEndDate: string;
  readonly currentBalance: string;
  readonly periodAllocation: string;
  readonly lowBalanceThreshold: string;
  readonly lookbackDays: string;
  readonly dailyUsage: string;
  readonly lowMultiplier: string;
  readonly baseMultiplier: string;
  readonly highMultiplier: string;
  readonly balanceSchedule: string;
  readonly extensions?: NamespacedExtensions | undefined;
}

export interface ForecastPreset {
  readonly key: "on-track" | "watch" | "at-risk";
  readonly label: string;
  readonly description: string;
  readonly draft: ForecastDraft;
}

export class ForecastDraftParseError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(message: string, issues: readonly ValidationIssue[]) {
    super(message);
    this.name = "ForecastDraftParseError";
    this.issues = issues;
  }
}

const completeHistory = (values: readonly string[]): string =>
  values
    .map((creditsUsed, index) =>
      `2026-07-${String(index + 1).padStart(2, "0")},${creditsUsed}`,
    )
    .join("\n");

const commonDraft = {
  schemaVersion: "1.0",
  methodologyVersion: "1.0",
  periodStartDate: "2026-07-01",
  asOf: "2026-07-15",
  periodEndDate: "2026-08-01",
  lookbackDays: "7",
  lowMultiplier: "0.75",
  baseMultiplier: "1",
  highMultiplier: "1.35",
  extensions: {
    "demo.reference": {
      productKey: "sample-product",
      segmentKey: "growth",
    },
  },
} as const;

export const forecastPresets: readonly ForecastPreset[] = [
  {
    key: "on-track",
    label: "On track",
    description: "Variable weekday usage with healthy period-end runway.",
    draft: {
      ...commonDraft,
      currentBalance: "1800",
      periodAllocation: "2600",
      lowBalanceThreshold: "250",
      dailyUsage: completeHistory([
        "43", "48", "0", "51", "55", "49", "46",
        "62", "58", "0", "60", "57", "64", "61",
      ]),
      balanceSchedule: "",
    },
  },
  {
    key: "watch",
    label: "Watch closely",
    description: "Base usage finishes low; high usage depletes before period end.",
    draft: {
      ...commonDraft,
      currentBalance: "1000",
      periodAllocation: "2100",
      lowBalanceThreshold: "250",
      dailyUsage: completeHistory([
        "38", "45", "42", "0", "50", "49", "54",
        "48", "52", "47", "55", "58", "51", "56",
      ]),
      balanceSchedule: "",
    },
  },
  {
    key: "at-risk",
    label: "At risk",
    description: "Rising usage plus an expiration puts every scenario under pressure.",
    draft: {
      ...commonDraft,
      currentBalance: "620",
      periodAllocation: "1900",
      lowBalanceThreshold: "190",
      dailyUsage: completeHistory([
        "31", "35", "39", "0", "44", "47", "50",
        "52", "55", "58", "61", "64", "67", "70",
      ]),
      balanceSchedule: JSON.stringify({
        date: "2026-07-24",
        creditDelta: "-120",
        reason: "Promotional credits expire",
      }),
    },
  },
];

function nonEmptyLines(source: string): readonly string[] {
  return source
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseDailyUsage(source: string): readonly {
  readonly date: string;
  readonly creditsUsed: string;
}[] {
  return nonEmptyLines(source).map((line) => {
    const [date = "", creditsUsed = "", ...extra] = line.split(",");
    return {
      date: date.trim(),
      creditsUsed: extra.length === 0 ? creditsUsed.trim() : `${creditsUsed},${extra.join(",")}`,
    };
  });
}

function parseSchedule(source: string): readonly {
  readonly date: string;
  readonly creditDelta: string;
  readonly reason?: string;
}[] {
  return nonEmptyLines(source).map((line, index) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid JSON";
      throw new ForecastDraftParseError("Scheduled balance change could not be parsed", [
        {
          code: "INVALID_SCHEDULE_ROW",
          path: `input.balance.schedule[${index}]`,
          message: `Expected one JSON object on this line: ${message}`,
        },
      ]);
    }
    return parsed as {
      readonly date: string;
      readonly creditDelta: string;
      readonly reason?: string;
    };
  });
}

export function buildForecastInput(draft: ForecastDraft): ForecastInput {
  const rawInput = {
    schemaVersion: draft.schemaVersion,
    methodologyVersion: draft.methodologyVersion,
    asOf: draft.asOf,
    period: {
      startDate: draft.periodStartDate,
      endDate: draft.periodEndDate,
      allocation: draft.periodAllocation,
      lowBalanceThreshold: draft.lowBalanceThreshold,
    },
    lookbackDays: Number(draft.lookbackDays),
    dailyUsage: parseDailyUsage(draft.dailyUsage),
    balance: {
      current: draft.currentBalance,
      schedule: parseSchedule(draft.balanceSchedule),
    },
    scenarios: [
      { key: "low", burnMultiplier: draft.lowMultiplier },
      { key: "base", burnMultiplier: draft.baseMultiplier },
      { key: "high", burnMultiplier: draft.highMultiplier },
    ],
    ...(draft.extensions === undefined ? {} : { extensions: draft.extensions }),
  };

  return parseAndValidateForecastInput(rawInput);
}

export function draftFromForecastInput(input: ForecastInput): ForecastDraft {
  const scenario = (key: "low" | "base" | "high") => {
    const value = input.scenarios.find((candidate) => candidate.key === key);
    if (value === undefined) {
      throw new Error(`Forecast input is missing the ${key} scenario`);
    }
    return value;
  };

  return {
    schemaVersion: input.schemaVersion,
    methodologyVersion: input.methodologyVersion,
    periodStartDate: input.period.startDate,
    asOf: input.asOf,
    periodEndDate: input.period.endDate,
    currentBalance: input.balance.current,
    periodAllocation: input.period.allocation,
    lowBalanceThreshold: input.period.lowBalanceThreshold,
    lookbackDays: String(input.lookbackDays),
    dailyUsage: input.dailyUsage
      .map(({ date, creditsUsed }) => `${date},${creditsUsed}`)
      .join("\n"),
    lowMultiplier: scenario("low").burnMultiplier,
    baseMultiplier: scenario("base").burnMultiplier,
    highMultiplier: scenario("high").burnMultiplier,
    balanceSchedule: input.balance.schedule
      .map(({ date, creditDelta, reason }) => JSON.stringify({
        date,
        creditDelta,
        ...(reason === undefined ? {} : { reason }),
      }))
      .join("\n"),
    ...(input.extensions === undefined ? {} : { extensions: input.extensions }),
  };
}
