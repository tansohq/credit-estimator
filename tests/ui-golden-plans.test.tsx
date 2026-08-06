// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { axe, toHaveNoViolations } from "jest-axe";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { planCreditUsage } from "../packages/core/src/index.js";
import { CreditPlanView } from "../packages/ui-react/src/index.js";
import type { PlanInput } from "../packages/schema/src/index.js";

interface GoldenPlanFixture {
  readonly name: string;
  readonly input: PlanInput;
  readonly expectedError?: unknown;
}

expect.extend(toHaveNoViolations);
afterEach(cleanup);

const fixturesDirectory = resolve(process.cwd(), "fixtures/golden-plans");

const fixtures = readdirSync(fixturesDirectory)
  .filter((fileName) => fileName.endsWith(".json"))
  .sort()
  .map((fileName) =>
    JSON.parse(readFileSync(join(fixturesDirectory, fileName), "utf8")) as GoldenPlanFixture,
  );

describe("golden plans render in the React UI", () => {
  it("discovers every JSON fixture", () => {
    expect(fixtures).toHaveLength(9);
  });

  fixtures.forEach((fixture) => {
    if (fixture.expectedError !== undefined) {
      it(`${fixture.name} remains a calculation error`, () => {
        expect(() => planCreditUsage(fixture.input)).toThrow();
      });
      return;
    }

    it(`${fixture.name} renders without accessibility violations`, async () => {
      const result = planCreditUsage(fixture.input);
      const { container } = render(
        <CreditPlanView input={fixture.input} result={result} />,
      );

      expect(
        screen.getByRole("heading", { name: "Credit plan estimate" }),
      ).toBeInTheDocument();
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
