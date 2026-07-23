// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CreditBurndown,
  CreditBurndownView,
  type CreditBurndownMessages,
} from "../src/index.js";
import {
  forecastInput,
  forecastResult,
  riskForecastInput,
  riskForecastResult,
  timelineForecastFixture,
  zeroUsageForecastInput,
  zeroUsageForecastResult,
} from "./fixture.js";

expect.extend(toHaveNoViolations);
afterEach(cleanup);

const preChangeLocale: CreditBurndownMessages = {
  title: "Previsión de créditos",
  summaryTitle: "Resumen de previsión",
  scenariosTitle: "Escenarios de uso",
  scenarioControlLabel: "Selecciona un escenario de uso",
  chartTitle: "Saldo de créditos previsto",
  warningsTitle: "Alertas de previsión",
  breakdownTitle: "Desglose del cálculo",
  actionsLabel: "Acciones de previsión",
  currentBalanceLabel: "Saldo actual",
  allocationLabel: "Asignación del periodo",
  usedToDateLabel: "Usado hasta la fecha",
  baselineDailyBurnLabel: "Consumo diario base",
  endingBalanceLabel: "Saldo final previsto",
  depletionDateLabel: "Fecha de agotamiento prevista",
  statusLabel: "Estado",
  dailyBurnLabel: "Consumo diario",
  projectedUsageLabel: "Uso previsto",
  projectedConsumptionLabel: "Consumo previsto del periodo",
  utilizationLabel: "Utilización prevista",
  shortfallLabel: "Déficit previsto",
  periodLabel: "Periodo de previsión",
  asOfLabel: "Inicio de previsión",
  lookbackLabel: "Ventana histórica",
  observedTableCaption: "Uso diario de créditos observado",
  projectedTableCaption: (scenario) => `Saldo diario previsto para ${scenario}`,
  dateHeader: "Fecha",
  dailyUsageHeader: "Créditos usados",
  cumulativeUsageHeader: "Créditos acumulados",
  startBalanceHeader: "Saldo inicial",
  balanceDeltaHeader: "Cambio de saldo",
  endingBalanceHeader: "Saldo final",
  noWarnings: "Sin alertas de previsión.",
  calculationTraceSummary: "Cómo se calculó esta previsión",
  sourceInputsTitle: "Datos de origen",
  stepsTitle: "Pasos del cálculo",
  formulaLabel: "Fórmula",
  operandsLabel: "Operandos",
  resultLabel: "Resultado",
  scenarioLabel: (key) => ({ low: "Bajo", base: "Medio", high: "Alto" })[key],
  statusText: (status) => ({
    ON_TRACK: "En curso",
    LOW_BALANCE_PROJECTED: "Saldo bajo previsto",
    DEPLETION_PROJECTED: "Agotamiento previsto",
  })[status],
  creditsValue: (value) => `${value} créditos`,
  scenarioBalanceValue: (value) => value,
  utilizationValue: (value) => `${value}× asignación`,
  dayCount: (count) => `${count} días`,
  periodValue: (startDate, endDate) => `${startDate} a ${endDate}`,
  chartDescription: (scenario, endingBalance) =>
    `${scenario}: saldo final ${endingBalance} créditos.`,
  lowBalanceWarning: (scenario, endingBalance, threshold) =>
    `${scenario}: saldo ${endingBalance}; umbral ${threshold}.`,
  depletionWarning: (scenario, depletionDate, shortfall) =>
    `${scenario}: agotamiento ${depletionDate}; déficit ${shortfall}.`,
  versionMismatch: ({ inputSchemaVersion, resultSchemaVersion }) =>
    `Versiones incompatibles: ${inputSchemaVersion}, ${resultSchemaVersion}.`,
};

describe("CreditBurndown", () => {
  it("renders the assembled forecast view", () => {
    const { container } = render(
      <CreditBurndownView input={forecastInput} result={forecastResult} />,
    );

    expect(screen.getByRole("heading", { name: "Credit usage forecast" })).toBeInTheDocument();
    const outcome = container.querySelector<HTMLElement>(".credit-burndown-outcome");
    expect(within(outcome as HTMLElement).getByText("Base")).toBeVisible();
    expect(within(outcome as HTMLElement).getByText("Projected ending balance")).toBeVisible();
    expect(within(outcome as HTMLElement).getByText("60 credits")).toBeVisible();
    expect(screen.getAllByText("100 credits").length).toBeGreaterThan(0);
    expect(screen.getAllByText("On track").length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: /projected credit balance/i })).toBeInTheDocument();
    const chartContext = container.querySelector<HTMLElement>(".credit-burndown-chart-context");
    const forecastStartContext = within(chartContext as HTMLElement)
      .getByText("Forecast starts").closest("div");
    expect(forecastStartContext).not.toBeNull();
    expect(
      within(forecastStartContext as HTMLElement).getByText("2026-01-03"),
    ).toBeVisible();
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
    const outcome = document.querySelector<HTMLElement>(".credit-burndown-outcome");
    expect(within(outcome as HTMLElement).getByText("40 credits")).toBeVisible();
    expect(screen.getAllByText("Projected daily balance for the High scenario")).toHaveLength(3);
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

  it("places host actions after visible warnings in the assembled view", () => {
    render(
      <CreditBurndownView
        input={forecastInput}
        result={forecastResult}
        actions={<button type="button">Review usage</button>}
      />,
    );

    const warnings = screen.getByRole("region", { name: "Forecast warnings" });
    const actions = screen.getByRole("group", { name: "Forecast actions" });

    expect(warnings.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it("renders one internally consistent risk result across summary, chart, warnings, and trace", async () => {
    const user = userEvent.setup();
    render(
      <CreditBurndownView
        input={riskForecastInput}
        result={riskForecastResult}
        selectedScenario="high"
      />,
    );

    expect(screen.getAllByText("Depletion projected").length).toBeGreaterThan(0);
    expect(screen.getByText(/Low scenario ends with 20 credits/i)).toBeInTheDocument();
    expect(screen.getByText(/Base scenario reaches depletion on 2026-01-04/i)).toBeInTheDocument();
    expect(screen.getByText(/High scenario reaches depletion on 2026-01-04/i)).toBeInTheDocument();
    const outcome = document.querySelector<HTMLElement>(".credit-burndown-outcome");
    expect(within(outcome as HTMLElement).getByText("Projected depletion date")).toBeVisible();
    expect(within(outcome as HTMLElement).getByText("2026-01-04")).toBeVisible();
    expect(screen.getByRole("img", { name: "Projected credit balance" }))
      .toHaveAccessibleDescription(/End balance: -20 credits/i);

    await user.click(screen.getByText("How this forecast was calculated"));
    expect(screen.getByRole("table", {
      name: "Projected daily balance for the High scenario",
    })).toHaveTextContent("-20 credits");
    expect(screen.getByRole("heading", { name: "high.points" })).toBeVisible();
    expect(screen.getAllByText("Projected depletion date")).toHaveLength(2);
    expect(screen.getByText("Status")).toBeVisible();
    expect(screen.getAllByText("2026-01-04").length).toBeGreaterThan(0);
  });

  it("exposes warning updates through a polite atomic live region", () => {
    const { rerender } = render(
      <CreditBurndownView input={forecastInput} result={forecastResult} />,
    );
    rerender(
      <CreditBurndownView input={riskForecastInput} result={riskForecastResult} />,
    );

    const liveRegion = screen.getByRole("region", { name: "Forecast warnings" });
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
    expect(liveRegion).toHaveAttribute("aria-atomic", "true");
    expect(liveRegion).toHaveTextContent(/Low scenario ends with 20 credits/i);
  });

  it("keeps audit tables and traces in a collapsed native disclosure", async () => {
    const user = userEvent.setup();
    render(<CreditBurndownView input={forecastInput} result={forecastResult} />);

    const disclosure = screen.getByText("How this forecast was calculated");
    const details = disclosure.closest("details");

    expect(details).not.toHaveAttribute("open");
    const collapsedTable = screen.getByRole("table", {
      name: "Observed daily credit usage",
    });
    expect(collapsedTable).not.toBeVisible();

    await user.click(disclosure);

    expect(details).toHaveAttribute("open");
    expect(collapsedTable).toBeVisible();
    expect(screen.getByRole("heading", { name: "Source inputs" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Calculation steps" })).toBeVisible();
  });

  it("provides exact accessible values when the public Chart renders alone", () => {
    render(
      <CreditBurndown.Root input={forecastInput} result={forecastResult}>
        <CreditBurndown.Chart />
      </CreditBurndown.Root>,
    );

    const chart = screen.getByRole("img", { name: "Projected credit balance" });
    expect(chart).toHaveAccessibleDescription(/Observed daily credit usage/i);
    expect(chart).toHaveAccessibleDescription(/2026-01-01.*20 credits.*20 credits/i);
    expect(chart).toHaveAccessibleDescription(/2026-01-04.*20 credits.*60 credits/i);
    expect(chart).toHaveAccessibleDescription(/accessible chart description/i);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it.each([
    { observedDays: 1, projectedDays: 9, alignment: "start" },
    { observedDays: 9, projectedDays: 1, alignment: "end" },
  ])("aligns an $alignment forecast-start label to its full-viewBox marker", ({
    observedDays,
    projectedDays,
    alignment,
  }) => {
    const [timelineInput, timelineResult] = timelineForecastFixture(
      observedDays,
      projectedDays,
    );
    const { container } = render(
      <CreditBurndown.Root input={timelineInput} result={timelineResult}>
        <CreditBurndown.Chart />
      </CreditBurndown.Root>,
    );
    const marker = container.querySelector(".credit-burndown-chart-forecast-start");
    const context = container.querySelector<HTMLElement>(".credit-burndown-chart-context");
    const markerX = Number(marker?.getAttribute("x1"));
    const markerPosition = (markerX / 760) * 100;
    const labelPosition = Number(
      context?.style.getPropertyValue("--credit-burndown-forecast-start-position")
        .replace("%", ""),
    );
    const rawPlotRatio = (observedDays / (observedDays + projectedDays)) * 100;
    const label = context?.querySelector(".credit-burndown-chart-context-forecast-start");

    expect(labelPosition).toBeCloseTo(markerPosition);
    expect(labelPosition).not.toBeCloseTo(rawPlotRatio);
    expect(label).toHaveAttribute("data-credit-burndown-alignment", alignment);
    expect(within(context as HTMLElement).getByText("Forecast starts")).toBeVisible();
  });

  it("renders zero observed usage as zero-height bars", () => {
    const { container } = render(
      <CreditBurndown.Root input={zeroUsageForecastInput} result={zeroUsageForecastResult}>
        <CreditBurndown.Chart />
      </CreditBurndown.Root>,
    );
    const bars = [...container.querySelectorAll(".credit-burndown-chart-observed-bar")];

    expect(bars).toHaveLength(2);
    expect(bars.map((bar) => bar.getAttribute("height"))).toEqual(["0", "0"]);
  });

  it("provides exact daily tables after the audit disclosure opens", async () => {
    const user = userEvent.setup();
    render(<CreditBurndownView input={forecastInput} result={forecastResult} />);

    await user.click(screen.getByText("How this forecast was calculated"));

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

  it("renders new hierarchy from a complete pre-change locale contract", () => {
    const { container } = render(
      <CreditBurndownView
        input={forecastInput}
        result={forecastResult}
        messages={preChangeLocale}
      />,
    );
    const outcome = container.querySelector<HTMLElement>(".credit-burndown-outcome");
    const chart = container.querySelector<HTMLElement>(".credit-burndown-chart");
    const legend = container.querySelector<HTMLElement>(".credit-burndown-chart-legend");

    expect(screen.getByRole("heading", { name: "Previsión de créditos" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Medio" })).toBeInTheDocument();
    expect(within(outcome as HTMLElement).getByText("Saldo final previsto")).toBeVisible();
    expect(within(outcome as HTMLElement).getByText("60 créditos")).toBeVisible();
    expect(within(legend as HTMLElement).getByText("Uso diario de créditos observado")).toBeVisible();
    expect(within(legend as HTMLElement).getByText("Saldo diario previsto para Medio")).toBeVisible();
    expect(within(chart as HTMLElement).getByText("Inicio de previsión")).toBeVisible();
    expect(screen.getByText("Cómo se calculó esta previsión")).toBeVisible();
    expect(screen.queryByText("Forecast starts")).not.toBeInTheDocument();
    expect(screen.queryByText("How this forecast was calculated")).not.toBeInTheDocument();
  });

  it("applies partial message overrides", () => {
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
