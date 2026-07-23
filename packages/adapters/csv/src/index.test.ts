import type { ForecastInput, ForecastResult } from "@tanso-hq/credit-forecast-schema";
import { describe, expect, it } from "vitest";

import {
  CsvImportError,
  exportForecastInputCsv,
  exportForecastResultCsv,
  parseForecastInputCsv,
  parseForecastResultCsv,
} from "./index.js";

const input: ForecastInput = {
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
  balance: {
    current: "85",
    schedule: [
      { date: "2026-01-04", creditDelta: "20", reason: "Grant, \"manual\"\napproved" },
    ],
  },
  scenarios: [
    { key: "low", burnMultiplier: "0.5" },
    { key: "base", burnMultiplier: "1" },
    { key: "high", burnMultiplier: "1.5" },
  ],
  extensions: { "com.example": { label: "Customer, Inc." } },
};

const result: ForecastResult = {
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
  scenarios: [
    {
      key: "low",
      dailyBurn: "3.75",
      projectedCreditsUsed: "7.5",
      projectedPeriodConsumption: "22.5",
      utilization: "0.225",
      endingBalance: "97.5",
      shortfall: "0",
      depletionDate: null,
      status: "ON_TRACK",
      points: [
        { date: "2026-01-03", startBalance: "85", balanceDelta: "0", creditsUsed: "3.75", endingBalance: "81.25" },
        { date: "2026-01-04", startBalance: "81.25", balanceDelta: "20", creditsUsed: "3.75", endingBalance: "97.5" },
      ],
    },
    {
      key: "base",
      dailyBurn: "7.5",
      projectedCreditsUsed: "15",
      projectedPeriodConsumption: "30",
      utilization: "0.3",
      endingBalance: "90",
      shortfall: "0",
      depletionDate: null,
      status: "ON_TRACK",
      points: [
        { date: "2026-01-03", startBalance: "85", balanceDelta: "0", creditsUsed: "7.5", endingBalance: "77.5" },
        { date: "2026-01-04", startBalance: "77.5", balanceDelta: "20", creditsUsed: "7.5", endingBalance: "90" },
      ],
    },
    {
      key: "high",
      dailyBurn: "11.25",
      projectedCreditsUsed: "22.5",
      projectedPeriodConsumption: "37.5",
      utilization: "0.375",
      endingBalance: "82.5",
      shortfall: "0",
      depletionDate: null,
      status: "ON_TRACK",
      points: [
        { date: "2026-01-03", startBalance: "85", balanceDelta: "0", creditsUsed: "11.25", endingBalance: "73.75" },
        { date: "2026-01-04", startBalance: "73.75", balanceDelta: "20", creditsUsed: "11.25", endingBalance: "82.5" },
      ],
    },
  ],
  warnings: [],
  calculationTrace: {
    sourceInputs: [{ path: "input.balance.current", value: "85" }],
    steps: [
      {
        key: "creditsUsedToDate",
        formula: "sum(dailyUsage[*].creditsUsed)",
        operands: { dailyCreditsUsed: ["5", "10"] },
        result: "15",
      },
    ],
  },
};

describe("CSV adapter", () => {
  it("round-trips every input field with RFC 4180 escaping", () => {
    const bundle = exportForecastInputCsv(input);

    expect(bundle["balance-schedule.csv"]).toContain('"Grant, ""manual""\napproved"');
    expect(parseForecastInputCsv(bundle)).toEqual(input);
  });

  it("round-trips an empty schedule and omitted extensions", () => {
    const minimal = {
      ...input,
      balance: { current: input.balance.current, schedule: [] },
      extensions: undefined,
    };
    const { extensions: _extensions, ...withoutExtensions } = minimal;

    expect(parseForecastInputCsv(exportForecastInputCsv(withoutExtensions))).toEqual(withoutExtensions);
  });

  it("round-trips summary, points, warnings, and traces", () => {
    expect(parseForecastResultCsv(exportForecastResultCsv(result))).toEqual(result);
  });

  it.each([
    {
      name: "missing files",
      bundle: {},
      code: "MISSING_FILE",
    },
    {
      name: "invalid headers",
      bundle: { ...exportForecastInputCsv(input), "manifest.csv": "wrong,headers\r\n" },
      code: "INVALID_CSV",
    },
    {
      name: "unterminated quoted fields",
      bundle: { ...exportForecastInputCsv(input), "manifest.csv": "\"key,value\r\n" },
      code: "INVALID_CSV",
    },
    {
      name: "wrong column counts",
      bundle: { ...exportForecastInputCsv(input), "daily-usage.csv": "date,creditsUsed\r\n2026-01-01,5,extra\r\n" },
      code: "INVALID_CSV",
    },
    {
      name: "missing required manifest values",
      bundle: {
        ...exportForecastInputCsv(input),
        "manifest.csv": exportForecastInputCsv(input)["manifest.csv"]
          ?.replace("schemaVersion,1.0\r\n", "") ?? "",
      },
      code: "MISSING_VALUE",
    },
    {
      name: "invalid extension JSON",
      bundle: {
        ...exportForecastInputCsv(input),
        "manifest.csv": exportForecastInputCsv(input)["manifest.csv"]
          ?.replace('extensions,"{', 'extensions,"not-json') ?? "",
      },
      code: "INVALID_CSV",
    },
    {
      name: "schema-invalid forecasts",
      bundle: {
        ...exportForecastInputCsv(input),
        "manifest.csv": exportForecastInputCsv(input)["manifest.csv"]
          ?.replace("period.allocation,100", "period.allocation,0") ?? "",
      },
      code: "INVALID_FORECAST",
    },
  ] as const)("reports $name", ({ bundle, code }) => {
    try {
      parseForecastInputCsv(bundle);
      throw new Error("Expected parseForecastInputCsv to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(CsvImportError);
      expect((error as CsvImportError).issues[0]?.code).toBe(code);
    }
  });

  it("rejects unknown result warning codes", () => {
    const bundle = exportForecastResultCsv({
      ...result,
      scenarios: result.scenarios.map((scenario) =>
        scenario.key === "base"
          ? { ...scenario, status: "LOW_BALANCE_PROJECTED" as const }
          : scenario,
      ),
      warnings: [{
        code: "LOW_BALANCE_PROJECTED",
        scenarioKey: "base",
        endingBalance: "90",
        threshold: "90",
      }],
    });
    const invalid = {
      ...bundle,
      "warnings.csv": bundle["warnings.csv"]?.replace(
        "LOW_BALANCE_PROJECTED",
        "UNKNOWN_WARNING",
      ) ?? "",
    };

    expect(() => parseForecastResultCsv(invalid)).toThrow(CsvImportError);
  });
});
