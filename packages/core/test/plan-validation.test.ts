import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { PlanInput } from "@tansohq/credit-forecast-schema";
import { describe, expect, it } from "vitest";

import { PlanValidationError, planCreditUsage } from "../src/index.js";

const fixturePath = fileURLToPath(
  new URL("../../../fixtures/golden-plans/monthly-over-allocation.json", import.meta.url),
);
const baseInput = (JSON.parse(readFileSync(fixturePath, "utf8")) as { input: PlanInput }).input;

const validationFailure = (input: unknown): PlanValidationError => {
  try {
    planCreditUsage(input);
  } catch (error) {
    expect(error).toBeInstanceOf(PlanValidationError);
    return error as PlanValidationError;
  }
  throw new Error("Expected plan validation failure");
};

type MutablePlanInput = {
  schemaVersion: string;
  methodologyVersion: string;
  period: { startDate: string; endDate: string };
  metricEstimates: {
    key: string;
    label?: string;
    estimatedUnits: string;
    creditsPerUnit: string;
  }[];
  allocation?: string;
  scenarios: { key: "low" | "base" | "high"; burnMultiplier: string }[];
  extensions?: Record<string, unknown>;
};

const mutableCopy = (): MutablePlanInput =>
  structuredClone(baseInput) as MutablePlanInput;

describe("plan validation", () => {
  it("does not default required inputs", () => {
    const failure = validationFailure({
      schemaVersion: "1.0",
      methodologyVersion: "1.0",
    });
    expect(failure.code).toBe("INVALID_INPUT");
    expect(failure.issues.some(({ code }) => code === "REQUIRED_FIELD")).toBe(true);
  });

  it("returns null versions for non-object input", () => {
    const failure = validationFailure(null);
    expect(failure.schemaVersion).toBeNull();
    expect(failure.methodologyVersion).toBeNull();
  });

  it.each([
    {
      name: "period end must be later than period start",
      change: (input: MutablePlanInput) => {
        input.period.endDate = input.period.startDate;
      },
      code: "INVALID_PLAN_PERIOD",
    },
    {
      name: "empty metric estimates",
      change: (input: MutablePlanInput) => {
        input.metricEstimates = [];
      },
      code: "EMPTY_METRIC_ESTIMATES",
    },
    {
      name: "non-positive allocation",
      change: (input: MutablePlanInput) => {
        input.allocation = "0";
      },
      code: "NON_POSITIVE_ALLOCATION",
    },
    {
      name: "negative credits per unit",
      change: (input: MutablePlanInput) => {
        const first = input.metricEstimates[0];
        if (first !== undefined) first.creditsPerUnit = "-1";
      },
      code: "NEGATIVE_CREDITS_PER_UNIT",
    },
    {
      name: "negative burn multiplier",
      change: (input: MutablePlanInput) => {
        const low = input.scenarios[0];
        if (low !== undefined) low.burnMultiplier = "-0.5";
      },
      code: "NEGATIVE_BURN_MULTIPLIER",
    },
    {
      name: "base multiplier must equal one",
      change: (input: MutablePlanInput) => {
        input.scenarios = [
          { key: "low", burnMultiplier: "1" },
          { key: "base", burnMultiplier: "2" },
          { key: "high", burnMultiplier: "3" },
        ];
      },
      code: "INVALID_BASE_MULTIPLIER",
    },
    {
      name: "unsupported schema version",
      change: (input: MutablePlanInput) => {
        input.schemaVersion = "2.0";
      },
      code: "UNSUPPORTED_SCHEMA_VERSION",
    },
    {
      name: "non-namespaced extension key",
      change: (input: MutablePlanInput) => {
        input.extensions = { plain: true };
      },
      code: "INVALID_EXTENSION_NAMESPACE",
    },
    {
      name: "non-canonical decimal estimated units",
      change: (input: MutablePlanInput) => {
        const first = input.metricEstimates[0];
        if (first !== undefined) first.estimatedUnits = "1.50";
      },
      code: "INVALID_DECIMAL",
    },
    {
      name: "unrecognized field",
      change: (input: MutablePlanInput) => {
        (input as Record<string, unknown>)["lookbackDays"] = 3;
      },
      code: "UNRECOGNIZED_FIELD",
    },
  ])("rejects $name", ({ change, code }) => {
    const input = mutableCopy();
    change(input);
    const failure = validationFailure(input);
    expect(failure.schemaVersion).toBe(input.schemaVersion);
    expect(failure.methodologyVersion).toBe(input.methodologyVersion);
    expect(failure.issues.map((issue) => issue.code)).toContain(code);
  });

  it("serializes a portable failure envelope", () => {
    const input = mutableCopy();
    input.metricEstimates = [];
    const failure = validationFailure(input);
    expect(failure.toJSON()).toEqual({
      schemaVersion: "1.0",
      methodologyVersion: "1.0",
      code: "INVALID_INPUT",
      issues: [
        {
          code: "EMPTY_METRIC_ESTIMATES",
          path: "input.metricEstimates",
          message: "metricEstimates must contain at least one metric estimate",
        },
      ],
    });
  });
});
