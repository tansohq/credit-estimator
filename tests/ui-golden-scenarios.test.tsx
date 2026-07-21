// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { axe, toHaveNoViolations } from "jest-axe";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { forecastCreditUsage } from "../packages/core/src/index.js";
import { CreditBurndownView } from "../packages/ui-react/src/index.js";
import type { ForecastInput } from "../packages/schema/src/index.js";

interface GoldenFixture {
  readonly name: string;
  readonly input: ForecastInput;
  readonly expectedError?: unknown;
}

expect.extend(toHaveNoViolations);
afterEach(cleanup);

const fixturesDirectory = resolve(process.cwd(), "fixtures/golden-scenarios");

const fixtures = readdirSync(fixturesDirectory)
  .filter((fileName) => fileName.endsWith(".json"))
  .sort()
  .map((fileName) =>
    JSON.parse(readFileSync(join(fixturesDirectory, fileName), "utf8")) as GoldenFixture,
  );

describe("golden scenarios render in the React UI", () => {
  it("discovers every JSON fixture", () => {
    expect(fixtures).toHaveLength(12);
  });

  fixtures.forEach((fixture) => {
    if (fixture.expectedError !== undefined) {
      it(`${fixture.name} remains a calculation error`, () => {
        expect(() => forecastCreditUsage(fixture.input)).toThrow();
      });
      return;
    }

    it(`${fixture.name} renders without accessibility violations`, async () => {
      const result = forecastCreditUsage(fixture.input);
      const { container } = render(
        <CreditBurndownView input={fixture.input} result={result} />,
      );

      expect(
        screen.getByRole("heading", { name: "Credit usage forecast" }),
      ).toBeInTheDocument();
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
