import { CreditBurndownView } from "@tansohq/credit-burndown-react";
import { forecastCreditUsage, ForecastValidationError } from "@tansohq/credit-forecast-core";
import { serializeForecastResult } from "@tansohq/credit-forecast-json";
import { useState, type ChangeEvent, type FormEvent } from "react";

import {
  buildForecastInput,
  forecastPresets,
  type ForecastDraft,
  type ForecastPreset,
} from "./demo-data.js";

interface ForecastSnapshot {
  readonly input: ReturnType<typeof buildForecastInput>;
  readonly result: ReturnType<typeof forecastCreditUsage>;
}

function initialForecastDraft(): ForecastDraft {
  const preset = forecastPresets[1];
  if (preset === undefined) {
    throw new Error("The demo requires at least one forecast preset");
  }
  return preset.draft;
}

const initialDraft = initialForecastDraft();

function calculateSnapshot(draft: ForecastDraft): ForecastSnapshot {
  const input = buildForecastInput(draft);
  return { input, result: forecastCreditUsage(input) };
}

function validationMessage(error: unknown): string {
  if (error instanceof ForecastValidationError) {
    return error.issues.map((issue) => `${issue.path}: ${issue.message}`).join(" ");
  }
  if (error instanceof Error) return error.message;
  return "Forecast could not be calculated.";
}

export function App() {
  const [draft, setDraft] = useState<ForecastDraft>(initialDraft);
  const [snapshot, setSnapshot] = useState<ForecastSnapshot>(() =>
    calculateSnapshot(initialDraft),
  );
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState(
    "Watch closely example loaded.",
  );
  const fieldInvalid = (inputPath: string) => error?.includes(inputPath) ?? false;

  const updateDraft =
    (field: keyof ForecastDraft) => (event: ChangeEvent<HTMLInputElement>) => {
      setDraft((current) => ({ ...current, [field]: event.target.value }));
    };

  const applyDraft = (nextDraft: ForecastDraft, message: string) => {
    try {
      const nextSnapshot = calculateSnapshot(nextDraft);
      setSnapshot(nextSnapshot);
      setError(null);
      setAnnouncement(message);
    } catch (caught) {
      setError(validationMessage(caught));
      setAnnouncement("Forecast input needs attention.");
    }
  };

  const calculate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applyDraft(draft, `Forecast updated for ${draft.currentBalance} available credits.`);
  };

  const loadPreset = (preset: ForecastPreset) => {
    setDraft(preset.draft);
    applyDraft(preset.draft, `${preset.label} example loaded.`);
  };

  const exportResult = () => {
    const blob = new Blob([serializeForecastResult(snapshot.result)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "credit-forecast.json";
    link.click();
    URL.revokeObjectURL(url);
    setAnnouncement("Forecast JSON downloaded.");
  };

  return (
    <div className="demo-shell">
      <a className="demo-skip-link" href="#main-content">
        Skip to forecast
      </a>

      <header className="demo-header">
        <a className="demo-brand" href="#main-content">
          <span className="demo-brand-mark" aria-hidden="true">CR</span>
          <span>Credit runway</span>
        </a>
        <span className="demo-local-badge">Runs locally</span>
      </header>

      <main id="main-content" className="demo-main">
        <section className="demo-intro" aria-labelledby="demo-title">
          <p className="demo-eyebrow">Customer dashboard reference</p>
          <h1 id="demo-title">Will these credits last?</h1>
          <p>
            Test a customer snapshot. Calculation stays in this browser; the
            embedded forecast uses the same provider-neutral packages an
            adopting product would install.
          </p>
          <div className="demo-runway-scale" aria-hidden="true">
            <span>Cycle start</span>
            <i />
            <span>Today</span>
            <i />
            <span>Cycle end</span>
          </div>
        </section>

        <div className="demo-layout">
          <aside className="demo-controls" aria-labelledby="controls-title">
            <div className="demo-controls-heading">
              <p>Input snapshot</p>
              <h2 id="controls-title">Test a forecast</h2>
            </div>

            <div className="demo-presets" aria-label="Forecast examples">
              {forecastPresets.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => loadPreset(preset)}
                >
                  <strong>Load {preset.label}</strong>
                  <span>{preset.description}</span>
                </button>
              ))}
            </div>

            <form onSubmit={calculate} noValidate>
              <div className="demo-field">
                <label htmlFor="current-balance">Current balance</label>
                <input
                  id="current-balance"
                  inputMode="decimal"
                  value={draft.currentBalance}
                  onChange={updateDraft("currentBalance")}
                  aria-invalid={fieldInvalid("input.balance.current")}
                  aria-describedby={
                    fieldInvalid("input.balance.current")
                      ? "current-balance-help forecast-input-error"
                      : "current-balance-help"
                  }
                />
                <span id="current-balance-help">Available credits on 2026-04-08</span>
              </div>

              <div className="demo-field">
                <label htmlFor="daily-usage">Observed daily usage</label>
                <input
                  id="daily-usage"
                  inputMode="decimal"
                  value={draft.dailyUsage}
                  onChange={updateDraft("dailyUsage")}
                  aria-invalid={fieldInvalid("input.dailyUsage")}
                  aria-describedby={
                    fieldInvalid("input.dailyUsage")
                      ? "daily-usage-help forecast-input-error"
                      : "daily-usage-help"
                  }
                />
                <span id="daily-usage-help">Applied to the complete seven-day history</span>
              </div>

              <div className="demo-field-row">
                <div className="demo-field">
                  <label htmlFor="period-allocation">Period allocation</label>
                  <input
                    id="period-allocation"
                    inputMode="decimal"
                    value={draft.periodAllocation}
                    onChange={updateDraft("periodAllocation")}
                    aria-invalid={fieldInvalid("input.period.allocation")}
                    aria-describedby={
                      fieldInvalid("input.period.allocation")
                        ? "forecast-input-error"
                        : undefined
                    }
                  />
                </div>
                <div className="demo-field">
                  <label htmlFor="low-threshold">Low threshold</label>
                  <input
                    id="low-threshold"
                    inputMode="decimal"
                    value={draft.lowBalanceThreshold}
                    onChange={updateDraft("lowBalanceThreshold")}
                    aria-invalid={fieldInvalid("input.period.lowBalanceThreshold")}
                    aria-describedby={
                      fieldInvalid("input.period.lowBalanceThreshold")
                        ? "forecast-input-error"
                        : undefined
                    }
                  />
                </div>
              </div>

              <div className="demo-field">
                <label htmlFor="scheduled-change">Scheduled balance change</label>
                <input
                  id="scheduled-change"
                  inputMode="decimal"
                  value={draft.scheduledChange}
                  onChange={updateDraft("scheduledChange")}
                  aria-invalid={fieldInvalid("input.balance.schedule")}
                  aria-describedby={
                    fieldInvalid("input.balance.schedule")
                      ? "scheduled-change-help forecast-input-error"
                      : "scheduled-change-help"
                  }
                />
                <span id="scheduled-change-help">Applied before usage on 2026-04-15</span>
              </div>

              {error !== null && (
                <p id="forecast-input-error" className="demo-error" role="alert">
                  {error}
                </p>
              )}

              <button className="demo-calculate" type="submit">
                Calculate forecast
              </button>
            </form>

            <p className="demo-privacy-note">
              No login. No network request. No customer data stored.
            </p>
          </aside>

          <section className="demo-output" aria-label="Calculated credit forecast">
            <CreditBurndownView
              className="demo-forecast"
              input={snapshot.input}
              result={snapshot.result}
              headingLevel={2}
              actions={
                <button className="demo-export" type="button" onClick={exportResult}>
                  Download JSON
                </button>
              }
            />
          </section>
        </div>

        <p className="demo-announcement" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
      </main>

      <footer className="demo-footer">
        <span>Schema 1.0</span>
        <span>Methodology 1.0</span>
        <span>Provider-neutral reference</span>
      </footer>
    </div>
  );
}
