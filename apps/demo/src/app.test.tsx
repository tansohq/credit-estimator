// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "./app.js";

expect.extend(toHaveNoViolations);
afterEach(cleanup);

describe("reference demo", () => {
  it("renders the watch example as a customer dashboard", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Will these credits last?" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Credit usage forecast" })).toBeVisible();
    expect(screen.getByLabelText("Current balance")).toHaveValue("1100");
    expect(screen.getByText("Runs locally")).toBeVisible();
  });

  it("does not recalculate while the host snapshot is being edited", async () => {
    const user = userEvent.setup();
    render(<App />);

    const balance = screen.getByLabelText("Current balance");
    await user.clear(balance);
    await user.type(balance, "500");

    expect(screen.queryByText("Forecast updated for 500 available credits.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Calculate forecast" }));

    expect(screen.getByText("Forecast updated for 500 available credits.")).toBeInTheDocument();
    expect(screen.getAllByText("500 credits").length).toBeGreaterThan(0);
  });

  it("loads an explicit risk preset", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /At risk/i }));

    expect(screen.getByLabelText("Current balance")).toHaveValue("600");
    expect(screen.getByText("At risk example loaded.")).toBeInTheDocument();
    expect(screen.getAllByText(/depletion projected/i).length).toBeGreaterThan(0);
  });

  it("reports invalid decimal input without replacing the prior forecast", async () => {
    const user = userEvent.setup();
    render(<App />);

    const balance = screen.getByLabelText("Current balance");
    await user.clear(balance);
    await user.type(balance, "not-a-number");
    await user.click(screen.getByRole("button", { name: "Calculate forecast" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/input\.balance\.current/i);
    expect(balance).toHaveAttribute("aria-invalid", "true");
    expect(balance).toHaveAccessibleDescription(/must be a canonical base-10 decimal/i);
    expect(screen.getAllByText("1100 credits").length).toBeGreaterThan(0);
  });

  it("has no automated accessibility violations", async () => {
    const { container } = render(<App />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
