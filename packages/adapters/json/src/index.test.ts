import { describe, expect, it } from "vitest";

import {
  JsonImportError,
  parseForecastInput,
  parseForecastResult,
  serializeForecastInput,
  serializeForecastResult,
} from "./index.js";

const input = {
  schemaVersion: "1.0",
  methodologyVersion: "1.0",
  asOf: "2026-01-03",
  period: {
    startDate: "2026-01-01",
    endDate: "2026-01-05",
    allocation: "100",
    lowBalanceThreshold: "10",
  },
  lookbackDays: 2,
  dailyUsage: [
    { date: "2026-01-01", creditsUsed: "5" },
    { date: "2026-01-02", creditsUsed: "10" },
  ],
  balance: { current: "85", schedule: [] },
  scenarios: [
    { key: "low", burnMultiplier: "0.5" },
    { key: "base", burnMultiplier: "1" },
    { key: "high", burnMultiplier: "1.5" },
  ],
  extensions: { "com.example": { label: "Quoted, \"value\"" } },
} as const;

const result = {
  schemaVersion: "1.0",
  methodologyVersion: "1.0",
  asOf: "2026-01-03",
  daysRemaining: 2,
  creditsUsedToDate: "15",
  baselineDailyBurn: "7.5",
  observedPoints: [
    { date: "2026-01-01", creditsUsed: "5", cumulativeCreditsUsed: "5" },
    { date: "2026-01-02", creditsUsed: "10", cumulativeCreditsUsed: "15" },
  ],
  scenarios: (["low", "base", "high"] as const).map((key) => ({
    key,
    dailyBurn: "7.5",
    projectedCreditsUsed: "15",
    projectedPeriodConsumption: "30",
    utilization: "0.3",
    endingBalance: "70",
    shortfall: "0",
    depletionDate: null,
    status: "ON_TRACK" as const,
    points: [
      { date: "2026-01-03", startBalance: "85", balanceDelta: "0", creditsUsed: "7.5", endingBalance: "77.5" },
      { date: "2026-01-04", startBalance: "77.5", balanceDelta: "0", creditsUsed: "7.5", endingBalance: "70" },
    ],
  })),
  warnings: [],
  calculationTrace: {
    sourceInputs: [{ path: "input.balance.current", value: "85" }],
    steps: [{
      key: "creditsUsedToDate",
      formula: "sum(dailyUsage[*].creditsUsed)",
      operands: { dailyCreditsUsed: ["5", "10"] },
      result: "15",
    }],
  },
} as const;

describe("JSON adapter", () => {
  it("round-trips a validated input deterministically", () => {
    const first = serializeForecastInput(input);
    const second = serializeForecastInput(parseForecastInput(first));

    expect(second).toBe(first);
    expect(parseForecastInput(first)).toEqual(input);
  });

  it("returns a structured parse failure", () => {
    expect(() => parseForecastInput("{"))
      .toThrow(JsonImportError);

    try {
      parseForecastInput("{");
    } catch (error) {
      expect(error).toBeInstanceOf(JsonImportError);
      expect((error as JsonImportError).issues[0]?.code).toBe("INVALID_JSON");
    }
  });

  it("round-trips a complete forecast result", () => {
    const serialized = serializeForecastResult(result);

    expect(parseForecastResult(serialized)).toEqual(result);
    expect(serializeForecastResult(parseForecastResult(serialized))).toBe(serialized);
  });

  it("returns structured schema issues", () => {
    try {
      parseForecastResult('{"schemaVersion":"1.0"}');
      throw new Error("Expected parseForecastResult to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(JsonImportError);
      expect((error as JsonImportError).issues[0]?.code).toBe("INVALID_FORECAST_RESULT");
    }
  });
});
