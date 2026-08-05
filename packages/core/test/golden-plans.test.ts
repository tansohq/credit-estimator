import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  PlanResultSchema,
  type ForecastValidationFailure,
  type PlanInput,
} from "@tansohq/credit-forecast-schema";
import { describe, expect, it } from "vitest";

import { PlanValidationError, planCreditUsage } from "../src/index.js";

interface GoldenPlanFixture {
  readonly name: string;
  readonly schemaVersion: string;
  readonly methodologyVersion: string;
  readonly input: PlanInput;
  readonly expected?: Readonly<Record<string, unknown>>;
  readonly expectedError?: ForecastValidationFailure;
  readonly execution?: { readonly repeatCount?: number };
}

const fixturesDirectory = fileURLToPath(
  new URL("../../../fixtures/golden-plans/", import.meta.url),
);

const fixtures = readdirSync(fixturesDirectory)
  .filter((fileName) => fileName.endsWith(".json"))
  .sort()
  .map((fileName) =>
    JSON.parse(readFileSync(`${fixturesDirectory}${fileName}`, "utf8")) as GoldenPlanFixture,
  );

const expectSubset = (actual: unknown, expected: unknown, path = "result"): void => {
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual), `${path} must be an array`).toBe(true);
    const actualArray = actual as readonly unknown[];
    expect(actualArray.length, `${path} must contain all expected entries`).toBeGreaterThanOrEqual(
      expected.length,
    );
    expected.forEach((value, index) => expectSubset(actualArray[index], value, `${path}[${index}]`));
    return;
  }

  if (typeof expected === "object" && expected !== null) {
    expect(typeof actual, `${path} must be an object`).toBe("object");
    expect(actual, `${path} must not be null`).not.toBeNull();
    Object.entries(expected).forEach(([key, value]) => {
      expectSubset((actual as Record<string, unknown>)[key], value, `${path}.${key}`);
    });
    return;
  }

  expect(actual, path).toEqual(expected);
};

describe("every golden plan", () => {
  it("discovers every JSON fixture", () => {
    expect(fixtures).toHaveLength(9);
  });

  fixtures.forEach((fixture) => {
    it(fixture.name, () => {
      expect(fixture.input.schemaVersion).toBe(fixture.schemaVersion);
      expect(fixture.input.methodologyVersion).toBe(fixture.methodologyVersion);
      const expectedEnvelope = fixture.expectedError ?? fixture.expected;
      expect(expectedEnvelope?.schemaVersion).toBe(fixture.schemaVersion);
      expect(expectedEnvelope?.methodologyVersion).toBe(fixture.methodologyVersion);

      if (fixture.expectedError !== undefined) {
        let thrown: unknown;
        try {
          planCreditUsage(fixture.input);
        } catch (error) {
          thrown = error;
        }
        expect(thrown).toBeInstanceOf(PlanValidationError);
        expect((thrown as PlanValidationError).toJSON()).toEqual(fixture.expectedError);
        return;
      }

      const result = planCreditUsage(fixture.input);
      expect(PlanResultSchema.safeParse(result).success).toBe(true);

      const { assertions: _assertions, ...expectedResult } = fixture.expected ?? {};
      expectSubset(result, expectedResult);

      expect(result.schemaVersion).toBe(fixture.input.schemaVersion);
      expect(result.methodologyVersion).toBe(fixture.input.methodologyVersion);
      expect(result.scenarios.map(({ key }) => key)).toEqual(["low", "base", "high"]);
      result.scenarios.forEach((scenario) => {
        expect(scenario.metricBreakdown).toHaveLength(result.metrics.length);
        expect(scenario.metricBreakdown.map(({ key }) => key)).toEqual(
          result.metrics.map(({ key }) => key),
        );
      });
      expect(result.scenarios[1]?.plannedCredits).toBe(result.baselinePlannedCredits);

      const repeatCount = fixture.execution?.repeatCount ?? 2;
      for (let run = 1; run < repeatCount; run += 1) {
        expect(planCreditUsage(fixture.input)).toEqual(result);
      }
    });
  });
});
