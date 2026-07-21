// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CreditBurndown,
  CreditBurndownView,
} from "../src/index.js";
import { forecastInput, forecastResult } from "./fixture.js";

expect.extend(toHaveNoViolations);
afterEach(cleanup);

describe("CreditBurndown", () => {
  it("renders the assembled forecast view", () => {
    render(<CreditBurndownView input={forecastInput} result={forecastResult} />);

    expect(screen.getByRole("heading", { name: "Credit usage forecast" })).toBeInTheDocument();
    expect(screen.getAllByText("100 credits").length).toBeGreaterThan(0);
    expect(screen.getAllByText("On track").length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: /projected credit balance/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Credit usage forecast" }).tagName).toBe("H2");
    expect(screen.getByRole("heading", { name: "Forecast summary" }).tagName).toBe("H3");
    expect(screen.getByRole("heading", { name: "Usage scenarios" })).toHaveAttribute(
      "aria-level",
      "3",
    );
  });

  it("keeps scenario selection controlled by the host", async () => {
    const user = userEvent.setup();
    const onSelectedScenarioChange = vi.fn();
    const { rerender } = render(
      <CreditBurndownView
        input={forecastInput}
        result={forecastResult}
        selectedScenario="low"
        onSelectedScenarioChange={onSelectedScenarioChange}
      />,
    );

    await user.click(screen.getByRole("radio", { name: /high/i }));

    expect(onSelectedScenarioChange).toHaveBeenCalledWith("high");
    expect(screen.getByRole("radio", { name: /low/i })).toBeChecked();

    rerender(
      <CreditBurndownView
        input={forecastInput}
        result={forecastResult}
        selectedScenario="high"
        onSelectedScenarioChange={onSelectedScenarioChange}
      />,
    );
    expect(screen.getByRole("radio", { name: /high/i })).toBeChecked();
    expect(screen.getByText("Projected daily balance for the High scenario")).toBeInTheDocument();
  });

  it("supports an uncontrolled default scenario", async () => {
    const user = userEvent.setup();
    render(
      <CreditBurndownView
        input={forecastInput}
        result={forecastResult}
        defaultSelectedScenario="low"
      />,
    );

    expect(screen.getByRole("radio", { name: /low/i })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: /base/i }));
    expect(screen.getByRole("radio", { name: /base/i })).toBeChecked();
  });

  it("supports keyboard scenario selection", async () => {
    const user = userEvent.setup();
    render(
      <CreditBurndownView input={forecastInput} result={forecastResult} />,
    );

    const base = screen.getByRole("radio", { name: "Base" });
    base.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("radio", { name: "High" })).toBeChecked();
  });

  it("describes scenario outcomes to assistive technology", () => {
    render(<CreditBurndownView input={forecastInput} result={forecastResult} />);

    expect(screen.getByRole("radio", { name: "Base" })).toHaveAccessibleDescription(
      /On track.*Daily burn: 20 credits.*Projected ending balance: 60 credits/i,
    );
  });

  it("rejects mismatched input and result versions before rendering children", () => {
    const mismatchedResult = { ...forecastResult, methodologyVersion: "2.0" };

    render(
      <CreditBurndown.Root input={forecastInput} result={mismatchedResult}>
        <CreditBurndown.Summary />
      </CreditBurndown.Root>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      /input methodology 1.0, result methodology 2.0/i,
    );
    expect(screen.queryByRole("heading", { name: "Forecast summary" })).not.toBeInTheDocument();
  });

  it("renders no action container unless the host supplies actions", () => {
    const { rerender } = render(
      <CreditBurndown.Root input={forecastInput} result={forecastResult}>
        <CreditBurndown.Actions />
      </CreditBurndown.Root>,
    );

    expect(screen.queryByRole("group", { name: "Forecast actions" })).not.toBeInTheDocument();

    rerender(
      <CreditBurndown.Root
        input={forecastInput}
        result={forecastResult}
        actions={<button type="button">Manage credits</button>}
      >
        <CreditBurndown.Actions />
      </CreditBurndown.Root>,
    );
    expect(screen.getByRole("group", { name: "Forecast actions" })).toContainElement(
      screen.getByRole("button", { name: "Manage credits" }),
    );
  });

  it("renders compound action children without defining their behavior", () => {
    render(
      <CreditBurndown.Root input={forecastInput} result={forecastResult}>
        <CreditBurndown.Actions>
          <a href="/usage-details">Usage details</a>
        </CreditBurndown.Actions>
      </CreditBurndown.Root>,
    );

    expect(screen.getByRole("link", { name: "Usage details" })).toHaveAttribute(
      "href",
      "/usage-details",
    );
  });

  it("renders structured low-balance and depletion warnings as text", () => {
    const resultWithRisk = {
      ...forecastResult,
      scenarios: forecastResult.scenarios.map((scenario) => {
        if (scenario.key === "base") {
          return { ...scenario, status: "LOW_BALANCE_PROJECTED" as const };
        }
        if (scenario.key === "high") {
          return {
            ...scenario,
            endingBalance: "-20",
            shortfall: "20",
            depletionDate: "2026-01-04",
            status: "DEPLETION_PROJECTED" as const,
          };
        }
        return scenario;
      }),
      warnings: [
        {
          code: "LOW_BALANCE_PROJECTED" as const,
          scenarioKey: "base" as const,
          endingBalance: "20",
          threshold: "30",
        },
        {
          code: "DEPLETION_PROJECTED" as const,
          scenarioKey: "high" as const,
          depletionDate: "2026-01-04",
          shortfall: "20",
        },
      ],
    };

    render(
      <CreditBurndownView
        input={forecastInput}
        result={resultWithRisk}
        selectedScenario="high"
      />,
    );

    expect(screen.getAllByText("Depletion projected").length).toBeGreaterThan(0);
    expect(screen.getByText(/Base scenario ends with 20 credits/i)).toBeInTheDocument();
    expect(screen.getByText(/High scenario reaches depletion on 2026-01-04/i)).toBeInTheDocument();
    expect(screen.getAllByText("2026-01-04").length).toBeGreaterThan(0);
  });

  it("exposes warning updates through a polite atomic live region", () => {
    const { rerender } = render(
      <CreditBurndownView input={forecastInput} result={forecastResult} />,
    );
    const riskResult = {
      ...forecastResult,
      warnings: [{
        code: "LOW_BALANCE_PROJECTED" as const,
        scenarioKey: "base" as const,
        endingBalance: "10",
        threshold: "10",
      }],
    };

    rerender(<CreditBurndownView input={forecastInput} result={riskResult} />);

    const liveRegion = screen.getByRole("region", { name: "Forecast warnings" });
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
    expect(liveRegion).toHaveAttribute("aria-atomic", "true");
    expect(liveRegion).toHaveTextContent(/Base scenario ends with 10 credits/i);
  });

  it("provides table equivalents for every visualized chart value", () => {
    render(
      <CreditBurndown.Root input={forecastInput} result={forecastResult}>
        <CreditBurndown.Chart />
      </CreditBurndown.Root>,
    );

    const observedTable = screen.getByRole("table", {
      name: "Observed daily credit usage",
    });
    const projectedTable = screen.getByRole("table", {
      name: "Projected daily balance for the Base scenario",
    });

    expect(observedTable).toHaveTextContent("2026-01-01");
    expect(observedTable).toHaveTextContent("40 credits");
    expect(projectedTable).toHaveTextContent("100 credits");
    expect(projectedTable).toHaveTextContent("60 credits");
    expect(
      screen.getByRole("region", { name: "Observed daily credit usage" }),
    ).toHaveAttribute("tabindex", "0");
    expect(
      screen.getByRole("region", {
        name: "Projected daily balance for the Base scenario",
      }),
    ).toHaveAttribute("tabindex", "0");
  });

  it("applies typed message overrides", () => {
    render(
      <CreditBurndownView
        input={forecastInput}
        result={forecastResult}
        messages={{
          title: "Previsión de créditos",
          scenarioLabel: (key) => ({ low: "Bajo", base: "Medio", high: "Alto" })[key],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Previsión de créditos" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /medio/i })).toBeInTheDocument();
  });

  it("supports host-controlled heading hierarchy", () => {
    render(
      <CreditBurndownView
        input={forecastInput}
        result={forecastResult}
        headingLevel={3}
      />,
    );

    expect(screen.getByRole("heading", { name: "Credit usage forecast" }).tagName).toBe("H3");
    expect(screen.getByRole("heading", { name: "Forecast summary" }).tagName).toBe("H4");
  });

  it("replaces input and result atomically", () => {
    const { rerender } = render(
      <CreditBurndownView input={forecastInput} result={forecastResult} />,
    );
    const nextInput = {
      ...forecastInput,
      balance: { ...forecastInput.balance, current: "200" },
    };
    const nextResult = {
      ...forecastResult,
      creditsUsedToDate: "80",
    };

    rerender(<CreditBurndownView input={nextInput} result={nextResult} />);

    expect(screen.getAllByText("200 credits").length).toBeGreaterThan(0);
    expect(screen.getAllByText("80 credits").length).toBeGreaterThan(0);
  });

  it("has no automated accessibility violations", async () => {
    const { container } = render(
      <CreditBurndownView input={forecastInput} result={forecastResult} />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });

});
