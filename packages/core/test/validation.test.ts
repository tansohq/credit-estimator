import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { ForecastInput } from "@tansohq/credit-forecast-schema";
import { describe, expect, it } from "vitest";

import { ForecastValidationError, forecastCreditUsage } from "../src/index.js";

const fixturePath = fileURLToPath(
  new URL("../../../fixtures/golden-scenarios/steady-on-track.json", import.meta.url),
);
const baseInput = (JSON.parse(readFileSync(fixturePath, "utf8")) as { input: ForecastInput }).input;

const validationFailure = (input: unknown): ForecastValidationError => {
  try {
    forecastCreditUsage(input);
  } catch (error) {
    expect(error).toBeInstanceOf(ForecastValidationError);
    return error as ForecastValidationError;
  }
  throw new Error("Expected forecast validation failure");
};

type MutableForecastInput = {
  schemaVersion: string;
  methodologyVersion: string;
  asOf: string;
  period: {
    startDate: string;
    endDate: string;
    allocation: string;
    lowBalanceThreshold: string;
  };
  lookbackDays: number;
  dailyUsage: { date: string; creditsUsed: string }[];
  balance: {
    current: string;
    schedule: { date: string; creditDelta: string; reason?: string }[];
  };
  scenarios: { key: "low" | "base" | "high"; burnMultiplier: string }[];
  extensions?: Record<string, unknown>;
};

const mutableCopy = (): MutableForecastInput =>
  structuredClone(baseInput) as MutableForecastInput;

describe("forecast validation", () => {
  it("does not default required inputs", () => {
    const failure = validationFailure({
      schemaVersion: "1.0",
      methodologyVersion: "1.0",
    });
    expect(failure.code).toBe("INVALID_INPUT");
    expect(failure.issues.some(({ code }) => code === "REQUIRED_FIELD")).toBe(true);
  });

  it.each([
    {
      name: "invalid period",
      change: (input: ReturnType<typeof mutableCopy>) => {
        input.asOf = input.period.startDate;
      },
      code: "INVALID_FORECAST_PERIOD",
    },
    {
      name: "non-positive allocation",
      change: (input: ReturnType<typeof mutableCopy>) => {
        input.period.allocation = "0";
      },
      code: "NON_POSITIVE_ALLOCATION",
    },
    {
      name: "negative usage",
      change: (input: ReturnType<typeof mutableCopy>) => {
        const first = input.dailyUsage[0];
        if (first !== undefined) first.creditsUsed = "-1";
      },
      code: "NEGATIVE_DAILY_USAGE",
    },
    {
      name: "negative threshold",
      change: (input: ReturnType<typeof mutableCopy>) => {
        input.period.lowBalanceThreshold = "-1";
      },
      code: "NEGATIVE_LOW_BALANCE_THRESHOLD",
    },
    {
      name: "duplicate history date",
      change: (input: ReturnType<typeof mutableCopy>) => {
        const second = input.dailyUsage[1];
        if (second !== undefined) second.date = "2026-01-01";
      },
      code: "DUPLICATE_DAILY_USAGE_DATE",
    },
    {
      name: "unordered history",
      change: (input: ReturnType<typeof mutableCopy>) => {
        const second = input.dailyUsage[1];
        if (second !== undefined) second.date = "2025-12-31";
      },
      code: "UNORDERED_DAILY_HISTORY",
    },
    {
      name: "extra history date",
      change: (input: ReturnType<typeof mutableCopy>) => {
        const last = input.dailyUsage.at(-1);
        if (last !== undefined) last.date = input.asOf;
      },
      code: "EXTRA_DAILY_HISTORY",
    },
    {
      name: "lookback larger than history",
      change: (input: ReturnType<typeof mutableCopy>) => {
        input.lookbackDays = 6;
      },
      code: "INVALID_LOOKBACK_DAYS",
    },
    {
      name: "scenario order",
      change: (input: ReturnType<typeof mutableCopy>) => {
        const low = input.scenarios[0];
        const base = input.scenarios[1];
        if (low !== undefined && base !== undefined) {
          input.scenarios[0] = base;
          input.scenarios[1] = low;
        }
      },
      code: "INVALID_SCENARIO_ORDER",
    },
    {
      name: "negative scenario multiplier",
      change: (input: ReturnType<typeof mutableCopy>) => {
        const low = input.scenarios[0];
        if (low !== undefined) low.burnMultiplier = "-0.5";
      },
      code: "NEGATIVE_BURN_MULTIPLIER",
    },
    {
      name: "base multiplier",
      change: (input: ReturnType<typeof mutableCopy>) => {
        const base = input.scenarios[1];
        if (base !== undefined) base.burnMultiplier = "0.9";
      },
      code: "INVALID_BASE_MULTIPLIER",
    },
    {
      name: "unordered scenario multipliers",
      change: (input: ReturnType<typeof mutableCopy>) => {
        const high = input.scenarios[2];
        if (high !== undefined) high.burnMultiplier = "0.75";
      },
      code: "INVALID_SCENARIO_MULTIPLIERS",
    },
    {
      name: "schedule range",
      change: (input: ReturnType<typeof mutableCopy>) => {
        input.balance.schedule = [{ date: "2026-01-05", creditDelta: "10" }];
      },
      code: "SCHEDULE_DATE_OUT_OF_RANGE",
    },
    {
      name: "schedule order",
      change: (input: ReturnType<typeof mutableCopy>) => {
        input.balance.schedule = [
          { date: "2026-01-09", creditDelta: "10" },
          { date: "2026-01-08", creditDelta: "10" },
        ];
      },
      code: "UNORDERED_BALANCE_SCHEDULE",
    },
    {
      name: "unsupported schema",
      change: (input: ReturnType<typeof mutableCopy>) => {
        input.schemaVersion = "2.0";
      },
      code: "UNSUPPORTED_SCHEMA_VERSION",
    },
    {
      name: "unsupported methodology",
      change: (input: ReturnType<typeof mutableCopy>) => {
        input.methodologyVersion = "2.0";
      },
      code: "UNSUPPORTED_METHODOLOGY_VERSION",
    },
    {
      name: "non-namespaced extension",
      change: (input: ReturnType<typeof mutableCopy>) => {
        input.extensions = { product: { account: "example" } };
      },
      code: "INVALID_EXTENSION_NAMESPACE",
    },
  ])("rejects $name", ({ change, code }) => {
    const input = mutableCopy();
    change(input);
    expect(validationFailure(input).issues.some((issue) => issue.code === code)).toBe(true);
  });

  it.each(["01", "+1", "1.0", "1e3", "0.1234567890123"])(
    "rejects non-canonical decimal %s",
    (allocation) => {
      const input = mutableCopy();
      input.period.allocation = allocation;
      expect(validationFailure(input).issues[0]?.code).toBe("INVALID_DECIMAL");
    },
  );

  it("allows multiple scheduled deltas on one date in supplied order", () => {
    const input = mutableCopy();
    input.balance.schedule = [
      { date: "2026-01-08", creditDelta: "10" },
      { date: "2026-01-08", creditDelta: "20" },
    ];
    const result = forecastCreditUsage(input);
    expect(result.scenarios[1]?.points[2]?.balanceDelta).toBe("30");
  });

  it("does not mutate caller input", () => {
    const input = mutableCopy();
    const original = structuredClone(input);
    forecastCreditUsage(input);
    expect(input).toEqual(original);
  });

  it("rejects invalid dates and unknown fields with stable structural codes", () => {
    const invalidDate = mutableCopy();
    invalidDate.asOf = "2026-02-30";
    expect(validationFailure(invalidDate).issues[0]?.code).toBe("INVALID_DATE");

    const unknownField = { ...mutableCopy(), productId: "product-specific" };
    expect(validationFailure(unknownField).issues[0]?.code).toBe("UNRECOGNIZED_FIELD");
  });

  it("echoes null versions when the payload has no portable envelope", () => {
    const failure = validationFailure(null);
    expect(failure.schemaVersion).toBeNull();
    expect(failure.methodologyVersion).toBeNull();
  });

  it("uses calendar-day arithmetic across leap months and year boundaries", () => {
    const input = mutableCopy();
    input.asOf = "2023-12-31";
    input.period = {
      startDate: "2023-12-30",
      endDate: "2024-03-02",
      allocation: "1000",
      lowBalanceThreshold: "10",
    };
    input.dailyUsage = [{ date: "2023-12-30", creditsUsed: "1" }];
    input.lookbackDays = 1;
    input.balance.current = "1000";
    input.balance.schedule = [];
    const result = forecastCreditUsage(input);
    expect(result.daysRemaining).toBe(62);
    expect(result.scenarios[1]?.points.some(({ date }) => date === "2024-02-29")).toBe(true);
  });

  it("preserves precision for large integer products without an input-length default", () => {
    const input = mutableCopy();
    const large = "9".repeat(300);
    input.dailyUsage = input.dailyUsage.map((entry) => ({ ...entry, creditsUsed: large }));
    input.period.allocation = `1${"0".repeat(700)}`;
    input.balance.current = `1${"0".repeat(700)}`;
    input.scenarios[0] = { key: "low", burnMultiplier: "0.5" };
    input.scenarios[1] = { key: "base", burnMultiplier: "1" };
    input.scenarios[2] = { key: "high", burnMultiplier: `1${"0".repeat(300)}` };
    const result = forecastCreditUsage(input);
    expect(result.scenarios[2]?.dailyBurn).toHaveLength(600);
    expect(result.scenarios[2]?.dailyBurn).not.toContain("e+");
  });
});
