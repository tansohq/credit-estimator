// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CreditPlan,
  CreditPlanView,
} from "../src/index.js";
import {
  estimateOnlyPlanInput,
  estimateOnlyPlanResult,
  planInput,
  planResult,
} from "./plan-fixture.js";

expect.extend(toHaveNoViolations);
afterEach(cleanup);

describe("CreditPlanView", () => {
  it("answers the buyer question for the expected scenario by default", () => {
    const { container } = render(
      <CreditPlanView input={planInput} result={planResult} />,
    );

    const summary = screen.getByRole("heading", { name: "Plan summary" })
      .closest("section");
    expect(summary).not.toBeNull();
    expect(within(summary as HTMLElement).getByText("600 credits")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Expected" })).toBeChecked();
    expect(container.querySelector(".credit-plan-status-badge")).toHaveTextContent(
      "Fits allocation",
    );
    expect(
      screen.getByRole("img", {
        name: "Expected scenario uses 85.71% of the 700-credit candidate allocation.",
      }),
    ).toBeInTheDocument();
  });

  it("switches scenarios and reflects over-allocation state", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CreditPlanView input={planInput} result={planResult} />,
    );

    await user.click(screen.getByRole("radio", { name: "Aggressive" }));

    expect(screen.getByRole("radio", { name: "Aggressive" })).toBeChecked();
    expect(
      container.querySelector('[data-credit-plan-status="OVER_ALLOCATION"]'),
    ).not.toBeNull();
    expect(container.querySelector(".credit-plan-status-badge")).toHaveTextContent(
      "Exceeds allocation",
    );
    const summary = screen.getByRole("heading", { name: "Plan summary" })
      .closest("section");
    expect(
      within(summary as HTMLElement).getByText("Additional credits needed"),
    ).toBeInTheDocument();
    const meter = screen.getByRole("img", {
      name: "Aggressive scenario uses 107.14% of the 700-credit candidate allocation.",
    });
    expect(meter).toHaveAttribute("data-credit-plan-over", "true");
  });

  it("lists over-allocation warnings in buyer language", () => {
    render(<CreditPlanView input={planInput} result={planResult} />);

    expect(
      screen.getByText(
        "Aggressive scenario needs 750 credits — 50 more than the 700-credit candidate allocation.",
      ),
    ).toBeInTheDocument();
  });

  it("renders an estimate-only plan without allocation artifacts", () => {
    const { container } = render(
      <CreditPlanView input={estimateOnlyPlanInput} result={estimateOnlyPlanResult} />,
    );

    expect(
      container.querySelector('[data-credit-plan-status="ESTIMATE_ONLY"]'),
    ).not.toBeNull();
    expect(container.querySelector(".credit-plan-status-badge")).toHaveTextContent(
      "Estimate only",
    );
    expect(screen.queryByText("Candidate allocation")).not.toBeInTheDocument();
    expect(container.querySelector(".credit-plan-meter")).toBeNull();
    expect(
      screen.getByText(
        "No candidate allocation supplied. Add one to compare scenarios against a commitment.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the per-metric breakdown with shares for the selected scenario", () => {
    render(<CreditPlanView input={planInput} result={planResult} />);

    const breakdown = screen.getByRole("heading", { name: "Where credits go" })
      .closest("section");
    expect(breakdown).not.toBeNull();
    const table = within(breakdown as HTMLElement).getByRole("table");
    expect(within(table).getByText("API calls")).toBeInTheDocument();
    expect(within(table).getByText("500 credits")).toBeInTheDocument();
    expect(within(table).getByText("83%")).toBeInTheDocument();
    expect(within(table).getByText("Generated reports")).toBeInTheDocument();
    expect(within(table).getByText("100 credits")).toBeInTheDocument();
    expect(within(table).getByText("17%")).toBeInTheDocument();
  });

  it("has no accessibility violations with and without an allocation", async () => {
    const withAllocation = render(
      <CreditPlanView input={planInput} result={planResult} />,
    );
    expect(await axe(withAllocation.container)).toHaveNoViolations();
    withAllocation.unmount();

    const estimateOnly = render(
      <CreditPlanView input={estimateOnlyPlanInput} result={estimateOnlyPlanResult} />,
    );
    expect(await axe(estimateOnly.container)).toHaveNoViolations();
  });
});

describe("CreditPlan.Root", () => {
  it("supports controlled scenario selection", async () => {
    const user = userEvent.setup();
    const onSelectedScenarioChange = vi.fn();
    render(
      <CreditPlan.Root
        input={planInput}
        result={planResult}
        selectedScenario="high"
        onSelectedScenarioChange={onSelectedScenarioChange}
      >
        <CreditPlan.Summary />
        <CreditPlan.Scenarios />
      </CreditPlan.Root>,
    );

    expect(screen.getByRole("radio", { name: "Aggressive" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Conservative" }));

    expect(onSelectedScenarioChange).toHaveBeenCalledWith("low");
    expect(screen.getByRole("radio", { name: "Aggressive" })).toBeChecked();
  });

  it("honors message overrides", () => {
    render(
      <CreditPlan.Root
        input={planInput}
        result={planResult}
        messages={{ title: "Combien de crédits ?" }}
      >
        <CreditPlan.Title />
      </CreditPlan.Root>,
    );

    expect(
      screen.getByRole("heading", { name: "Combien de crédits ?" }),
    ).toBeInTheDocument();
  });

  it("renders an alert when input and result versions differ", () => {
    render(
      <CreditPlan.Root
        input={planInput}
        result={{ ...planResult, schemaVersion: "1.1" }}
      >
        <CreditPlan.Summary />
      </CreditPlan.Root>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Plan input and result versions do not match.",
    );
  });

  it("renders host actions in the actions group", () => {
    render(
      <CreditPlan.Root
        input={planInput}
        result={planResult}
        actions={<button type="button">Buy credits</button>}
      >
        <CreditPlan.Actions />
      </CreditPlan.Root>,
    );

    expect(
      within(screen.getByRole("group", { name: "Plan actions" })).getByRole("button", {
        name: "Buy credits",
      }),
    ).toBeInTheDocument();
  });
});
