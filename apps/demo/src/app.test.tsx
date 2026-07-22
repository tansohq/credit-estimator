// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  exportForecastInputCsv,
  parseForecastInputCsv,
} from "@tansohq/credit-forecast-csv";
import { forecastCreditUsage } from "@tansohq/credit-forecast-core";
import {
  parseForecastInput,
  serializeForecastInput,
} from "@tansohq/credit-forecast-json";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./app.js";
import {
  buildForecastInput,
  draftFromForecastInput,
  forecastPresets,
  type ForecastDraft,
} from "./demo-data.js";

expect.extend(toHaveNoViolations);

const downloadedFiles: string[] = [];

beforeEach(() => {
  downloadedFiles.length = 0;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:forecast"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click(
    this: HTMLAnchorElement,
  ) {
    downloadedFiles.push(this.download);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function presetDraft(key: "on-track" | "watch" | "at-risk"): ForecastDraft {
  const preset = forecastPresets.find((candidate) => candidate.key === key);
  if (preset === undefined) throw new Error(`Missing ${key} preset`);
  return preset.draft;
}

function browserFile(
  name: string,
  contents: string,
  type: string,
  read: () => Promise<string> = async () => contents,
): File {
  const file = new File([contents], name, { type });
  Object.defineProperty(file, "text", {
    configurable: true,
    value: read,
  });
  return file;
}

function deferred<Value>() {
  let resolvePromise: ((value: Value) => void) | undefined;
  const promise = new Promise<Value>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve(value: Value) {
      if (resolvePromise === undefined) throw new Error("Deferred promise is unavailable");
      resolvePromise(value);
    },
  };
}

function currentBalanceSummary(): HTMLElement {
  const label = screen.getByText("Current balance", { selector: "dt" });
  const summaryItem = label.parentElement;
  if (summaryItem === null) throw new Error("Current balance summary is missing");
  return summaryItem;
}

describe("reference demo", () => {
  it("presents a real-input workbench and the exact embedded customer view", () => {
    render(<App />);

    expect(screen.getByRole("heading", {
      name: "Test a real usage snapshot. Preview the customer view.",
    })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Embedded widget preview" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Credit usage forecast" })).toBeVisible();
    expect(screen.getByLabelText("Forecast contract versions")).toHaveTextContent("schema 1.0");
    expect(screen.getByLabelText("Forecast contract versions")).toHaveTextContent("method 1.0");
    expect((screen.getByLabelText("Complete history") as HTMLTextAreaElement).value)
      .toContain("2026-07-04,0");
    expect((screen.getByLabelText("Complete history") as HTMLTextAreaElement).value)
      .toContain("2026-07-14,56");
    const integration = (screen.getByLabelText("Integration example") as HTMLTextAreaElement).value;
    expect(integration).toContain('import { forecastCreditUsage } from "@tansohq/credit-forecast-core";');
    expect(integration).toContain('import { CreditBurndownView } from "@tansohq/credit-burndown-react";');
    expect(integration).toContain('import "@tansohq/credit-burndown-react/styles.css";');
    expect(integration).toContain("export function UsageForecast");
    expect(integration).toContain("const result = forecastCreditUsage(input);");
    expect(integration).toContain("<CreditBurndownView input={input} result={result} />");
  });

  it("does not recalculate on edit and replaces the preview only on Calculate", async () => {
    const user = userEvent.setup();
    render(<App />);

    const balance = screen.getByLabelText("Current balance", { selector: "input" });
    expect(within(currentBalanceSummary()).getByText("1000 credits")).toBeVisible();

    await user.clear(balance);
    await user.type(balance, "500");

    expect(screen.getByText("Edited · not calculated")).toBeVisible();
    expect(within(currentBalanceSummary()).getByText("1000 credits")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Calculate forecast" }));

    expect(screen.getByText("Matches preview")).toBeVisible();
    expect(within(currentBalanceSummary()).getByText("500 credits")).toBeVisible();
  });

  it("rejects a missing observed day and retains the prior valid preview", async () => {
    const user = userEvent.setup();
    render(<App />);

    const history = screen.getByLabelText("Complete history");
    const missingDayHistory = presetDraft("watch").dailyUsage
      .split("\n")
      .filter((row) => !row.startsWith("2026-07-08,"))
      .join("\n");
    await user.clear(history);
    await user.type(history, missingDayHistory);
    await user.click(screen.getByRole("button", { name: "Calculate forecast" }));

    expect(screen.getByRole("alert")).toHaveTextContent("INCOMPLETE_DAILY_HISTORY");
    expect(screen.getByRole("alert")).toHaveTextContent("missing 2026-07-08");
    expect(within(currentBalanceSummary()).getByText("1000 credits")).toBeVisible();
    expect(screen.getByText("Edited · not calculated")).toBeVisible();
  });

  it("imports a validated JSON input without calculating and exports input and result JSON", async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = buildForecastInput({ ...presetDraft("on-track"), currentBalance: "321" });
    const file = browserFile(
      "forecast-input.json",
      serializeForecastInput(input),
      "application/json",
    );

    await user.upload(screen.getByLabelText("Import JSON input"), file);

    expect(screen.getByLabelText("Current balance", { selector: "input" })).toHaveValue("321");
    expect(screen.getByText("Edited · not calculated")).toBeVisible();
    expect(within(currentBalanceSummary()).getByText("1000 credits")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Calculate forecast" }));
    await user.click(screen.getByText("Import and export"));
    await user.click(screen.getByRole("button", { name: "Export input JSON" }));
    await user.click(screen.getByRole("button", { name: "Export result JSON" }));

    expect(downloadedFiles).toEqual(["forecast-input.json", "forecast-result.json"]);
    expect(within(currentBalanceSummary()).getByText("321 credits")).toBeVisible();
  });

  it("shows structured JSON adapter errors without clearing the editor or preview", async () => {
    const user = userEvent.setup();
    render(<App />);
    const file = browserFile("broken.json", "{", "application/json");

    await user.upload(screen.getByLabelText("Import JSON input"), file);

    expect(screen.getByRole("alert")).toHaveTextContent("INVALID_JSON");
    expect(screen.getByLabelText("Current balance", { selector: "input" })).toHaveValue("1000");
    expect(within(currentBalanceSummary()).getByText("1000 credits")).toBeVisible();
  });

  it("ignores a slow JSON import after a newer CSV import finishes", async () => {
    const user = userEvent.setup();
    render(<App />);
    const slowRead = deferred<string>();
    const slowInput = buildForecastInput({ ...presetDraft("on-track"), currentBalance: "111" });
    const fastInput = buildForecastInput({ ...presetDraft("on-track"), currentBalance: "222" });
    const slowFile = browserFile(
      "slow.json",
      "",
      "application/json",
      async () => slowRead.promise,
    );
    const fastFiles = Object.entries(exportForecastInputCsv(fastInput)).map(
      ([name, contents]) => browserFile(name, contents, "text/csv"),
    );

    await user.upload(screen.getByLabelText("Import JSON input"), slowFile);
    await user.upload(screen.getByLabelText("Import CSV input bundle"), fastFiles);

    await waitFor(() => {
      expect(screen.getByLabelText("Current balance", { selector: "input" })).toHaveValue("222");
    });

    await act(async () => {
      slowRead.resolve(serializeForecastInput(slowInput));
      await slowRead.promise;
    });

    expect(screen.getByLabelText("Current balance", { selector: "input" })).toHaveValue("222");
  });

  it("ignores a pending import after a manual edit", async () => {
    const user = userEvent.setup();
    render(<App />);
    const slowRead = deferred<string>();
    const imported = buildForecastInput({ ...presetDraft("on-track"), currentBalance: "111" });
    const slowFile = browserFile(
      "slow.json",
      "",
      "application/json",
      async () => slowRead.promise,
    );

    await user.upload(screen.getByLabelText("Import JSON input"), slowFile);
    const balance = screen.getByLabelText("Current balance", { selector: "input" });
    await user.clear(balance);
    await user.type(balance, "555");

    await act(async () => {
      slowRead.resolve(serializeForecastInput(imported));
      await slowRead.promise;
    });

    expect(balance).toHaveValue("555");
    expect(screen.getByText("Edited · not calculated")).toBeVisible();
  });

  it("imports the CSV bundle and prepares per-file downloads without automatic clicks", async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = buildForecastInput({ ...presetDraft("on-track"), currentBalance: "432" });
    const bundle = exportForecastInputCsv(input);
    const files = Object.entries(bundle).map(([name, contents]) =>
      browserFile(name, contents, "text/csv"),
    );

    await user.upload(screen.getByLabelText("Import CSV input bundle"), files);

    expect(screen.getByLabelText("Current balance", { selector: "input" })).toHaveValue("432");
    expect(screen.getByText("Edited · not calculated")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Calculate forecast" }));
    await user.click(screen.getByText("Import and export"));
    await user.click(screen.getByRole("button", { name: "Prepare input CSV files" }));

    expect(downloadedFiles).toEqual([]);
    expect(screen.getByText("CSV files ready.")).toBeInTheDocument();
    const inputFiles = screen.getByLabelText("Prepared input CSV files");
    expect(within(inputFiles).getAllByRole("button")).toHaveLength(4);
    await user.click(within(inputFiles).getByRole("button", { name: "Download manifest.csv" }));
    expect(downloadedFiles).toEqual(["manifest.csv"]);
    expect(screen.getByText("manifest.csv downloaded.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Prepare result CSV files" }));
    expect(downloadedFiles).toEqual(["manifest.csv"]);
    const resultFiles = screen.getByLabelText("Prepared result CSV files");
    expect(within(resultFiles).getAllByRole("button")).toHaveLength(7);
    await user.click(within(resultFiles).getByRole("button", { name: "Download result.csv" }));
    expect(downloadedFiles).toEqual(["manifest.csv", "result.csv"]);
  });

  it("applies an explicit scheduled balance delta through the core", async () => {
    const user = userEvent.setup();
    render(<App />);
    const draft = presetDraft("watch");
    const schedule = JSON.stringify({
      date: "2026-07-24",
      creditDelta: "200",
      reason: "Contracted grant",
    });
    const expected = forecastCreditUsage(buildForecastInput({ ...draft, balanceSchedule: schedule }));
    const expectedBase = expected.scenarios.find(({ key }) => key === "base");
    if (expectedBase === undefined) throw new Error("Base scenario is missing");

    await user.click(screen.getByText("Scheduled balance changes"));
    fireEvent.change(screen.getByLabelText("Future balance deltas"), {
      target: { value: schedule },
    });
    await user.click(screen.getByRole("button", { name: "Calculate forecast" }));

    const endingBalanceLabel = screen.getByText("Projected ending balance", { selector: "span" });
    const endingBalanceItem = endingBalanceLabel.parentElement;
    if (endingBalanceItem === null) throw new Error("Ending balance summary is missing");
    expect(within(endingBalanceItem).getByText(`${expectedBase.endingBalance} credits`)).toBeVisible();
  });

  it("round-trips commas and newlines in scheduled reasons through JSON and CSV", () => {
    const reason = "Grant, approved\nby finance";
    const source = buildForecastInput({
      ...presetDraft("on-track"),
      balanceSchedule: JSON.stringify({
        date: "2026-07-24",
        creditDelta: "200",
        reason,
      }),
    });
    const importedInputs = [
      parseForecastInput(serializeForecastInput(source)),
      parseForecastInputCsv(exportForecastInputCsv(source)),
    ];

    for (const imported of importedInputs) {
      const draft = draftFromForecastInput(imported);
      expect(draft.balanceSchedule.split("\n")).toHaveLength(1);
      expect(draft.balanceSchedule).toContain("Grant, approved\\nby finance");
      const calculatedInput = buildForecastInput(draft);
      expect(calculatedInput.balance.schedule[0]?.reason).toBe(reason);
      expect(() => forecastCreditUsage(calculatedInput)).not.toThrow();
    }
  });

  it("loads a complete risk preset without calculating until requested", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /At risk/i }));

    expect(screen.getByLabelText("Current balance", { selector: "input" })).toHaveValue("620");
    expect((screen.getByLabelText("Complete history") as HTMLTextAreaElement).value)
      .toContain("2026-07-14,70");
    expect(screen.getByText("Edited · not calculated")).toBeVisible();
    expect(within(currentBalanceSummary()).getByText("1000 credits")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Calculate forecast" }));
    expect(screen.getAllByText(/depletion projected/i).length).toBeGreaterThan(0);
  });

  it("has no automated accessibility violations", async () => {
    const { container } = render(<App />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
