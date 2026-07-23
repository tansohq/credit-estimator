import {
  exportForecastInputCsv,
  exportForecastResultCsv,
  CsvImportError,
} from "@tanso-hq/credit-forecast-csv";
import {
  forecastCreditUsage,
  ForecastValidationError,
} from "@tanso-hq/credit-forecast-core";
import {
  JsonImportError,
  serializeForecastInput,
  serializeForecastResult,
} from "@tanso-hq/credit-forecast-json";
import { CreditBurndownView } from "@tanso-hq/credit-burndown-react";
import {
  useState,
  useRef,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  downloadTextFile,
  prepareCsvFiles,
  readForecastInputCsv,
  readForecastInputJson,
  type PreparedCsvFile,
} from "./browser-files.js";
import {
  buildForecastInput,
  draftFromForecastInput,
  ForecastDraftParseError,
  forecastPresets,
  type ForecastDraft,
  type ForecastPreset,
} from "./demo-data.js";

interface ForecastSnapshot {
  readonly input: ReturnType<typeof buildForecastInput>;
  readonly result: ReturnType<typeof forecastCreditUsage>;
}

interface UiIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

const integrationCode = `import { forecastCreditUsage } from "@tanso-hq/credit-forecast-core";
import { CreditBurndownView } from "@tanso-hq/credit-burndown-react";
import "@tanso-hq/credit-burndown-react/styles.css";
import type { ForecastInput } from "@tanso-hq/credit-forecast-schema";

export function UsageForecast({ input }: { input: ForecastInput }) {
  const result = forecastCreditUsage(input);
  return <CreditBurndownView input={input} result={result} />;
}`;

function initialForecastDraft(): ForecastDraft {
  const preset = forecastPresets.find(({ key }) => key === "watch");
  if (preset === undefined) {
    throw new Error("The demo requires the watch preset");
  }
  return preset.draft;
}

const initialDraft = initialForecastDraft();

function calculateSnapshot(draft: ForecastDraft): ForecastSnapshot {
  const input = buildForecastInput(draft);
  return { input, result: forecastCreditUsage(input) };
}

function issuesFromError(error: unknown): readonly UiIssue[] {
  if (
    error instanceof ForecastValidationError ||
    error instanceof JsonImportError ||
    error instanceof CsvImportError ||
    error instanceof ForecastDraftParseError
  ) {
    return error.issues;
  }
  if (error instanceof Error) {
    return [{ code: "UNEXPECTED_ERROR", path: "$", message: error.message }];
  }
  return [{ code: "UNEXPECTED_ERROR", path: "$", message: "Unknown failure" }];
}

function fileList(event: ChangeEvent<HTMLInputElement>): readonly File[] {
  return event.target.files === null ? [] : Array.from(event.target.files);
}

export function App() {
  const importSequence = useRef(0);
  const [draft, setDraft] = useState<ForecastDraft>(initialDraft);
  const [snapshot, setSnapshot] = useState<ForecastSnapshot>(() =>
    calculateSnapshot(initialDraft),
  );
  const [issues, setIssues] = useState<readonly UiIssue[]>([]);
  const [dirty, setDirty] = useState(false);
  const [preparedCsv, setPreparedCsv] = useState<{
    readonly label: string;
    readonly files: readonly PreparedCsvFile[];
  } | null>(null);
  const [announcement, setAnnouncement] = useState(
    "Watch closely snapshot calculated.",
  );

  const fieldInvalid = (path: string) =>
    issues.some((issue) => issue.path.includes(path));

  const updateDraft =
    (field: keyof ForecastDraft) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      importSequence.current += 1;
      setDraft((current) => ({ ...current, [field]: event.target.value }));
      setDirty(true);
    };

  const showError = (caught: unknown, announcementText: string) => {
    setIssues(issuesFromError(caught));
    setAnnouncement(announcementText);
  };

  const calculate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const nextSnapshot = calculateSnapshot(draft);
      setSnapshot(nextSnapshot);
      setIssues([]);
      setDirty(false);
      setPreparedCsv(null);
      setAnnouncement(`Forecast calculated from ${draft.dailyUsage.split(/\r?\n/u).filter(Boolean).length} observed days.`);
    } catch (caught) {
      showError(caught, "Snapshot has validation errors. Previous forecast retained.");
    }
  };

  const loadPreset = (preset: ForecastPreset) => {
    importSequence.current += 1;
    setDraft(preset.draft);
    setIssues([]);
    setDirty(true);
    setAnnouncement(`${preset.label} snapshot loaded. Calculate to update the preview.`);
  };

  const populateImportedInput = (input: ForecastSnapshot["input"], format: string) => {
    setDraft(draftFromForecastInput(input));
    setIssues([]);
    setDirty(true);
    setAnnouncement(`${format} input loaded. Calculate to update the preview.`);
  };

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = fileList(event);
    event.target.value = "";
    if (file === undefined) return;
    const sequence = importSequence.current + 1;
    importSequence.current = sequence;
    try {
      const input = await readForecastInputJson(file);
      if (sequence !== importSequence.current) return;
      populateImportedInput(input, "JSON");
    } catch (caught) {
      if (sequence !== importSequence.current) return;
      showError(caught, "JSON input was not loaded. Previous forecast retained.");
    }
  };

  const importCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = fileList(event);
    event.target.value = "";
    if (files.length === 0) return;
    const sequence = importSequence.current + 1;
    importSequence.current = sequence;
    try {
      const input = await readForecastInputCsv(files);
      if (sequence !== importSequence.current) return;
      populateImportedInput(input, "CSV bundle");
    } catch (caught) {
      if (sequence !== importSequence.current) return;
      showError(caught, "CSV input was not loaded. Previous forecast retained.");
    }
  };

  const exportInputJson = () => {
    downloadTextFile(
      "forecast-input.json",
      serializeForecastInput(snapshot.input),
      "application/json",
    );
    setAnnouncement("Last calculated input exported as forecast-input.json.");
  };

  const exportResultJson = () => {
    downloadTextFile(
      "forecast-result.json",
      serializeForecastResult(snapshot.result),
      "application/json",
    );
    setAnnouncement("Last calculated result exported as forecast-result.json.");
  };

  const prepareInputCsv = () => {
    setPreparedCsv({
      label: "Prepared input CSV files",
      files: prepareCsvFiles(exportForecastInputCsv(snapshot.input)),
    });
    setAnnouncement("CSV files ready.");
  };

  const prepareResultCsv = () => {
    setPreparedCsv({
      label: "Prepared result CSV files",
      files: prepareCsvFiles(exportForecastResultCsv(snapshot.result)),
    });
    setAnnouncement("CSV files ready.");
  };

  const downloadPreparedCsv = (file: PreparedCsvFile) => {
    downloadTextFile(file.filename, file.contents, "text/csv;charset=utf-8");
    setAnnouncement(`${file.filename} downloaded.`);
  };

  return (
    <div className="demo-shell">
      <a className="demo-skip-link" href="#workbench">
        Skip to snapshot workbench
      </a>

      <header className="demo-header">
        <div>
          <span className="demo-brand-mark" aria-hidden="true">CR</span>
          <span className="demo-brand">Credit runway workbench</span>
        </div>
        <div className="demo-contract" aria-label="Forecast contract versions">
          <span>schema {draft.schemaVersion}</span>
          <span>method {draft.methodologyVersion}</span>
          <strong>Local</strong>
        </div>
      </header>

      <main id="workbench" className="demo-main">
        <section className="demo-intro" aria-labelledby="demo-title">
          <p className="demo-eyebrow">Local integration playground</p>
          <h1 id="demo-title">Test a real usage snapshot. Preview the customer view.</h1>
          <p>
            Supply complete observed history and explicit forecast assumptions.
            Nothing is fetched, stored, or inferred from missing days.
          </p>
        </section>

        <div className="demo-workbench">
          <section className="demo-input-panel" aria-labelledby="snapshot-title">
            <div className="demo-panel-heading">
              <div>
                <p>Source snapshot</p>
                <h2 id="snapshot-title">Forecast input</h2>
              </div>
              <span className={dirty ? "demo-state demo-state--dirty" : "demo-state"}>
                {dirty ? "Edited · not calculated" : "Matches preview"}
              </span>
            </div>

            <div className="demo-presets" aria-label="Complete snapshot examples">
              {forecastPresets.map((preset) => (
                <button key={preset.key} type="button" onClick={() => loadPreset(preset)}>
                  <strong>{preset.label}</strong>
                  <span>{preset.description}</span>
                </button>
              ))}
            </div>

            <form onSubmit={calculate} noValidate>
              <fieldset>
                <legend>Forecast window</legend>
                <p className="demo-fieldset-help">
                  Observed days cover period start through the day before forecast start.
                </p>
                <div className="demo-field-grid demo-field-grid--three">
                  <div className="demo-field">
                    <label htmlFor="period-start">Period start</label>
                    <input id="period-start" type="date" value={draft.periodStartDate} onChange={updateDraft("periodStartDate")} aria-invalid={fieldInvalid("period.startDate")} aria-describedby="period-help issue-list" />
                  </div>
                  <div className="demo-field">
                    <label htmlFor="as-of">Forecast starts</label>
                    <input id="as-of" type="date" value={draft.asOf} onChange={updateDraft("asOf")} aria-invalid={fieldInvalid("asOf")} aria-describedby="period-help issue-list" />
                  </div>
                  <div className="demo-field">
                    <label htmlFor="period-end">Period end</label>
                    <input id="period-end" type="date" value={draft.periodEndDate} onChange={updateDraft("periodEndDate")} aria-invalid={fieldInvalid("period.endDate")} aria-describedby="period-help issue-list" />
                  </div>
                </div>
                <span id="period-help" className="demo-sr-only">Dates use YYYY-MM-DD and half-open ranges.</span>
              </fieldset>

              <fieldset>
                <legend>Balance and allocation</legend>
                <div className="demo-field-grid demo-field-grid--three">
                  <div className="demo-field">
                    <label htmlFor="current-balance">Current balance</label>
                    <input id="current-balance" inputMode="decimal" value={draft.currentBalance} onChange={updateDraft("currentBalance")} aria-invalid={fieldInvalid("balance.current")} aria-describedby="balance-help issue-list" />
                  </div>
                  <div className="demo-field">
                    <label htmlFor="period-allocation">Period allocation</label>
                    <input id="period-allocation" inputMode="decimal" value={draft.periodAllocation} onChange={updateDraft("periodAllocation")} aria-invalid={fieldInvalid("period.allocation")} aria-describedby="balance-help issue-list" />
                  </div>
                  <div className="demo-field">
                    <label htmlFor="low-threshold">Low-balance threshold</label>
                    <input id="low-threshold" inputMode="decimal" value={draft.lowBalanceThreshold} onChange={updateDraft("lowBalanceThreshold")} aria-invalid={fieldInvalid("period.lowBalanceThreshold")} aria-describedby="balance-help issue-list" />
                  </div>
                </div>
                <span id="balance-help" className="demo-sr-only">Enter canonical base-10 decimal strings.</span>
              </fieldset>

              <fieldset>
                <legend>Observed daily usage</legend>
                <div className="demo-field demo-field--wide">
                  <label htmlFor="lookback-days">Lookback days</label>
                  <input id="lookback-days" type="number" min="1" step="1" value={draft.lookbackDays} onChange={updateDraft("lookbackDays")} aria-invalid={fieldInvalid("lookbackDays")} aria-describedby="history-format issue-list" />
                </div>
                <div className="demo-field">
                  <label htmlFor="daily-usage">Complete history</label>
                  <textarea id="daily-usage" rows={10} spellCheck="false" value={draft.dailyUsage} onChange={updateDraft("dailyUsage")} aria-invalid={fieldInvalid("dailyUsage")} aria-describedby="history-format issue-list" />
                  <span id="history-format">
                    One row per day: <code>YYYY-MM-DD,creditsUsed</code>. Include zero-use days as <code>0</code>.
                  </span>
                </div>
              </fieldset>

              <fieldset>
                <legend>Low, base, and high assumptions</legend>
                <div className="demo-field-grid demo-field-grid--three">
                  <div className="demo-field">
                    <label htmlFor="low-multiplier">Low multiplier</label>
                    <input id="low-multiplier" inputMode="decimal" value={draft.lowMultiplier} onChange={updateDraft("lowMultiplier")} aria-invalid={fieldInvalid("scenarios[0]")} aria-describedby="scenario-help issue-list" />
                  </div>
                  <div className="demo-field">
                    <label htmlFor="base-multiplier">Base multiplier</label>
                    <input id="base-multiplier" inputMode="decimal" value={draft.baseMultiplier} onChange={updateDraft("baseMultiplier")} aria-invalid={fieldInvalid("scenarios[1]")} aria-describedby="scenario-help issue-list" />
                  </div>
                  <div className="demo-field">
                    <label htmlFor="high-multiplier">High multiplier</label>
                    <input id="high-multiplier" inputMode="decimal" value={draft.highMultiplier} onChange={updateDraft("highMultiplier")} aria-invalid={fieldInvalid("scenarios[2]")} aria-describedby="scenario-help issue-list" />
                  </div>
                </div>
                <span id="scenario-help" className="demo-fieldset-help">Base must be 1; low must be below base and high above it.</span>
              </fieldset>

              <details className="demo-input-details">
                <summary>Scheduled balance changes <span>optional</span></summary>
                <div className="demo-field">
                  <label htmlFor="balance-schedule">Future balance deltas</label>
                  <textarea id="balance-schedule" rows={4} spellCheck="false" value={draft.balanceSchedule} onChange={updateDraft("balanceSchedule")} aria-invalid={fieldInvalid("balance.schedule")} aria-describedby="schedule-format issue-list" />
                  <span id="schedule-format">
                    One JSON object per line. Example: <code>{`{"date":"2026-07-24","creditDelta":"200","reason":"Contract grant"}`}</code>. JSON escaping preserves commas, quotes, and newlines in reasons.
                  </span>
                </div>
              </details>

              <div
                id="issue-list"
                className={issues.length > 0 ? "demo-errors" : "demo-sr-only"}
                role={issues.length > 0 ? "alert" : undefined}
              >
                {issues.length > 0 && (
                  <>
                    <strong>Fix {issues.length === 1 ? "this issue" : `${issues.length} issues`}</strong>
                    <ul>
                      {issues.map((issue, index) => (
                        <li key={`${issue.code}-${issue.path}-${index}`}>
                          <code>{issue.code}</code> <span>{issue.path}</span>: {issue.message}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              <button className="demo-calculate" type="submit">Calculate forecast</button>
            </form>

            <details className="demo-exchange">
              <summary>Import and export</summary>
              <p>Imports populate the editor. Calculate explicitly to replace the preview.</p>
              <div className="demo-import-grid">
                <div className="demo-file-field">
                  <label htmlFor="json-import">Import JSON input</label>
                  <input id="json-import" type="file" accept="application/json,.json" onChange={importJson} />
                </div>
                <div className="demo-file-field">
                  <label htmlFor="csv-import">Import CSV input bundle</label>
                  <input id="csv-import" type="file" accept="text/csv,.csv" multiple onChange={importCsv} aria-describedby="csv-import-help" />
                  <span id="csv-import-help">Select manifest.csv, daily-usage.csv, balance-schedule.csv, and scenarios.csv together.</span>
                </div>
              </div>
              <div className="demo-export-grid" aria-label="Export last calculated snapshot">
                <button type="button" onClick={exportInputJson}>Export input JSON</button>
                <button type="button" onClick={exportResultJson}>Export result JSON</button>
                <button type="button" onClick={prepareInputCsv}>Prepare input CSV files</button>
                <button type="button" onClick={prepareResultCsv}>Prepare result CSV files</button>
              </div>
              {preparedCsv !== null && (
                <div className="demo-prepared-files" aria-label={preparedCsv.label}>
                  <strong>{preparedCsv.label}</strong>
                  <ul>
                    {preparedCsv.files.map((file) => (
                      <li key={file.filename}>
                        <code>{file.filename}</code>
                        <button type="button" onClick={() => downloadPreparedCsv(file)}>
                          Download {file.filename}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </details>
          </section>

          <section className="demo-preview-column" aria-labelledby="preview-title">
            <div className="demo-preview-heading">
              <div>
                <p>Customer view</p>
                <h2 id="preview-title">Embedded widget preview</h2>
              </div>
              <span>Last calculated snapshot</span>
            </div>
            <div className="demo-dashboard-frame">
              <div className="demo-dashboard-bar" aria-hidden="true">
                <span />
                <i />
                <i />
              </div>
              <CreditBurndownView
                className="demo-forecast"
                input={snapshot.input}
                result={snapshot.result}
                headingLevel={3}
                actions={
                  <button className="demo-widget-action" type="button" onClick={exportResultJson}>
                    Export result
                  </button>
                }
              />
            </div>

            <details className="demo-integration" open>
              <summary>Local composition</summary>
              <p>
                Run the deterministic core in the browser, then pass its exact input and result to the controlled React view. A host backend can supply the same result.
              </p>
              <label htmlFor="integration-code">Integration example</label>
              <textarea id="integration-code" readOnly rows={9} value={integrationCode} />
            </details>
          </section>
        </div>

        <p className="demo-announcement" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
      </main>

      <footer className="demo-footer">
        <span>Provider-neutral</span>
        <span>Offline core</span>
        <span>No credentials</span>
        <span>No persistence</span>
      </footer>
    </div>
  );
}
