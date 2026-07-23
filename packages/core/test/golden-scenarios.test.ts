import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  ForecastResultSchema,
  type ForecastInput,
  type ForecastValidationFailure,
} from "@tanso-hq/credit-forecast-schema";
import { describe, expect, it } from "vitest";

import { ForecastValidationError, forecastCreditUsage } from "../src/index.js";

interface GoldenFixture {
  readonly name: string;
  readonly schemaVersion: string;
  readonly methodologyVersion: string;
  readonly input: ForecastInput;
  readonly expected?: Readonly<Record<string, unknown>>;
  readonly expectedError?: ForecastValidationFailure;
  readonly execution?: { readonly repeatCount?: number };
}

const fixturesDirectory = fileURLToPath(
  new URL("../../../fixtures/golden-scenarios/", import.meta.url),
);

const fixtures = readdirSync(fixturesDirectory)
  .filter((fileName) => fileName.endsWith(".json"))
  .sort()
  .map((fileName) =>
    JSON.parse(readFileSync(`${fixturesDirectory}${fileName}`, "utf8")) as GoldenFixture,
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

describe("every golden scenario", () => {
  it("discovers every JSON fixture", () => {
    expect(fixtures).toHaveLength(12);
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
          forecastCreditUsage(fixture.input);
        } catch (error) {
          thrown = error;
        }
        expect(thrown).toBeInstanceOf(ForecastValidationError);
        expect((thrown as ForecastValidationError).toJSON()).toEqual(fixture.expectedError);
        return;
      }

      const result = forecastCreditUsage(fixture.input);
      expect(ForecastResultSchema.safeParse(result).success).toBe(true);

      const { assertions: _assertions, ...expectedResult } = fixture.expected ?? {};
      expectSubset(result, expectedResult);

      expect(result.schemaVersion).toBe(fixture.input.schemaVersion);
      expect(result.methodologyVersion).toBe(fixture.input.methodologyVersion);
      expect(result.scenarios.map(({ key }) => key)).toEqual(["low", "base", "high"]);
      result.scenarios.forEach((scenario) => {
        expect(scenario.points).toHaveLength(result.daysRemaining);
        expect(scenario.points.at(-1)?.endingBalance).toBe(scenario.endingBalance);
      });

      const repeatCount = fixture.execution?.repeatCount ?? 2;
      for (let run = 1; run < repeatCount; run += 1) {
        expect(forecastCreditUsage(fixture.input)).toEqual(result);
      }
    });
  });
});
