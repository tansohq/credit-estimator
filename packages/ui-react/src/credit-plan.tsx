import {
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type {
  PlanStatus,
  ScenarioKey,
  ScenarioPlan,
  TraceValue,
} from "@tansohq/credit-forecast-schema";

import { CreditPlanContext, useCreditPlan } from "./plan-context.js";
import { resolveCreditPlanMessages } from "./plan-messages.js";
import type {
  CreditPlanActionsProps,
  CreditPlanRootProps,
  CreditPlanSectionProps,
  CreditPlanViewProps,
} from "./plan-types.js";
import type { CreditBurndownHeadingLevel } from "./types.js";

const scenarioKeys: readonly ScenarioKey[] = ["low", "base", "high"];

type HeadingTag = `h${CreditBurndownHeadingLevel}`;

function headingTag(level: CreditBurndownHeadingLevel): HeadingTag {
  return `h${level}`;
}

function nestedHeadingLevel(
  level: CreditBurndownHeadingLevel,
): CreditBurndownHeadingLevel {
  return Math.min(6, level + 1) as CreditBurndownHeadingLevel;
}

function classNames(base: string, className?: string): string {
  return className === undefined ? base : `${base} ${className}`;
}

function planStatusKey(status: PlanStatus | null): string {
  return status === null ? "estimate-only" : status.toLowerCase().replaceAll("_", "-");
}

function planStatusClass(status: PlanStatus | null): string {
  return `credit-plan-status credit-plan-status--${planStatusKey(status)}`;
}

function planStatusSymbol(status: PlanStatus | null): string {
  if (status === null) return "≈";
  if (status === "WITHIN_ALLOCATION") return "✓";
  return "×";
}

function traceValue(value: TraceValue): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

const ratioScale = 1_000_000_000_000n;
const ratioPrecision = 1_000_000n;

function decimalToScaledInteger(value: string): bigint {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const scaled = BigInt(whole) * ratioScale + BigInt(fraction.padEnd(12, "0") || "0");
  return negative ? -scaled : scaled;
}

function boundedRatio(part: string, whole: string): number {
  const scaledPart = decimalToScaledInteger(part);
  const scaledWhole = decimalToScaledInteger(whole);
  if (scaledPart <= 0n || scaledWhole <= 0n) return 0;
  if (scaledPart >= scaledWhole) return 1;
  return Number((scaledPart * ratioPrecision) / scaledWhole) / Number(ratioPrecision);
}

function exceedsOne(value: string): boolean {
  return decimalToScaledInteger(value) > ratioScale;
}

export function CreditPlanRoot({
  input,
  result,
  children,
  selectedScenario,
  defaultSelectedScenario = "base",
  onSelectedScenarioChange,
  headingLevel = 2,
  messages: messageOverrides,
  actions,
  className,
  ...divProps
}: CreditPlanRootProps) {
  const [internalScenario, setInternalScenario] = useState(defaultSelectedScenario);
  const messages = useMemo(
    () => resolveCreditPlanMessages(messageOverrides),
    [messageOverrides],
  );

  const versionsMatch =
    input.schemaVersion === result.schemaVersion &&
    input.methodologyVersion === result.methodologyVersion;

  if (!versionsMatch) {
    return (
      <div
        {...divProps}
        className={classNames("credit-plan-root credit-plan-version-error", className)}
        role="alert"
      >
        {messages.versionMismatch({
          inputSchemaVersion: input.schemaVersion,
          resultSchemaVersion: result.schemaVersion,
          inputMethodologyVersion: input.methodologyVersion,
          resultMethodologyVersion: result.methodologyVersion,
        })}
      </div>
    );
  }

  const selectedScenarioKey = selectedScenario ?? internalScenario;
  const scenario = result.scenarios.find(({ key }) => key === selectedScenarioKey);

  if (scenario === undefined) {
    throw new Error(`Plan result does not contain scenario ${selectedScenarioKey}`);
  }

  const selectScenario = (nextScenario: ScenarioKey) => {
    if (selectedScenario === undefined) setInternalScenario(nextScenario);
    onSelectedScenarioChange?.(nextScenario);
  };

  const context = {
    input,
    result,
    selectedScenarioKey,
    selectedScenario: scenario,
    selectScenario,
    headingLevel,
    messages,
    ...(actions === undefined ? {} : { actions }),
  };

  return (
    <CreditPlanContext.Provider value={context}>
      <div
        {...divProps}
        className={classNames("credit-plan-root", className)}
        data-credit-plan-status={scenario.comparison?.status ?? "ESTIMATE_ONLY"}
        role={divProps.role ?? "region"}
        aria-label={
          divProps["aria-label"] ??
          (divProps["aria-labelledby"] === undefined ? messages.title : undefined)
        }
      >
        {children}
      </div>
    </CreditPlanContext.Provider>
  );
}

export function CreditPlanTitle({ className }: CreditPlanSectionProps) {
  const { headingLevel, messages } = useCreditPlan();
  const Heading = headingTag(headingLevel);

  return (
    <Heading className={classNames("credit-plan-title", className)}>
      {messages.title}
    </Heading>
  );
}

function CreditPlanStatus({ className }: CreditPlanSectionProps) {
  const { selectedScenario, messages } = useCreditPlan();
  const status = selectedScenario.comparison?.status ?? null;

  return (
    <div
      className={classNames(
        `${planStatusClass(status)} credit-plan-status-badge`,
        className,
      )}
    >
      <span aria-hidden="true" className="credit-plan-status-symbol">
        {planStatusSymbol(status)}
      </span>
      <span>{messages.scenarioLabel(selectedScenario.key)}</span>
      <span aria-hidden="true">·</span>
      <span>{status === null ? messages.estimateOnlyStatus : messages.statusText(status)}</span>
    </div>
  );
}

function CreditPlanMeter() {
  const { selectedScenario, messages } = useCreditPlan();
  const comparison = selectedScenario.comparison;

  if (comparison === null) return null;

  const over = exceedsOne(comparison.utilization);
  const fillRatio = over
    ? 1
    : boundedRatio(selectedScenario.plannedCredits, comparison.allocation);
  const utilizationPercent = messages.percentValue(comparison.utilization);
  const meterStyle = {
    "--credit-plan-meter-fill": `${fillRatio * 100}%`,
  } as CSSProperties;

  return (
    <div className="credit-plan-meter-block">
      <div
        className="credit-plan-meter"
        data-credit-plan-over={over ? "true" : "false"}
        style={meterStyle}
        role="img"
        aria-label={messages.meterDescription(
          messages.scenarioLabel(selectedScenario.key),
          utilizationPercent,
          comparison.allocation,
        )}
      >
        <span className="credit-plan-meter-fill" />
      </div>
      <div className="credit-plan-meter-scale" aria-hidden="true">
        <span>0</span>
        <span className="credit-plan-meter-utilization">{utilizationPercent}</span>
        <span>{messages.scenarioCreditsValue(comparison.allocation)}</span>
      </div>
    </div>
  );
}

export function CreditPlanSummary({ className }: CreditPlanSectionProps) {
  const { input, result, selectedScenario, headingLevel, messages } = useCreditPlan();
  const headingId = useId();
  const Heading = headingTag(nestedHeadingLevel(headingLevel));
  const comparison = selectedScenario.comparison;
  const scenarioLabel = messages.scenarioLabel(selectedScenario.key);

  return (
    <section
      className={classNames("credit-plan-section credit-plan-summary", className)}
      aria-labelledby={headingId}
    >
      <Heading id={headingId} className="credit-plan-sr-only">
        {messages.summaryTitle}
      </Heading>
      <div className="credit-plan-outcome">
        <span className="credit-plan-outcome-scenario">{scenarioLabel}</span>
        <span className="credit-plan-outcome-label">{messages.plannedCreditsLabel}</span>
        <strong>{messages.creditsValue(selectedScenario.plannedCredits)}</strong>
      </div>
      <CreditPlanMeter />
      <dl className="credit-plan-summary-grid">
        <div className="credit-plan-stat">
          <dt>{messages.periodLabel}</dt>
          <dd>
            {messages.periodValue(input.period.startDate, input.period.endDate)}
          </dd>
        </div>
        <div className="credit-plan-stat">
          <dt>{messages.daysInPeriodLabel}</dt>
          <dd>{messages.dayCount(result.daysInPeriod)}</dd>
        </div>
        <div className="credit-plan-stat">
          <dt>{messages.averageDailyBurnLabel}</dt>
          <dd>{messages.creditsValue(selectedScenario.averageDailyBurn)}</dd>
        </div>
        {comparison !== null && (
          <div className="credit-plan-stat">
            <dt>{messages.allocationLabel}</dt>
            <dd>{messages.creditsValue(comparison.allocation)}</dd>
          </div>
        )}
        {comparison !== null && (
          <div className="credit-plan-stat">
            <dt>{messages.utilizationLabel}</dt>
            <dd>{messages.percentValue(comparison.utilization)}</dd>
          </div>
        )}
        {comparison !== null && (
          <div className="credit-plan-stat">
            <dt>
              {comparison.status === "OVER_ALLOCATION"
                ? messages.shortfallLabel
                : messages.surplusLabel}
            </dt>
            <dd>
              {messages.creditsValue(
                comparison.status === "OVER_ALLOCATION"
                  ? comparison.shortfall
                  : comparison.surplus,
              )}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

export function CreditPlanScenarios({ className }: CreditPlanSectionProps) {
  const {
    result,
    selectedScenarioKey,
    selectScenario,
    headingLevel,
    messages,
  } = useCreditPlan();
  const groupName = useId();
  const sectionHeadingLevel = nestedHeadingLevel(headingLevel);

  return (
    <fieldset
      className={classNames("credit-plan-section credit-plan-scenarios", className)}
    >
      <legend className="credit-plan-heading">
        <span role="heading" aria-level={sectionHeadingLevel}>
          {messages.scenariosTitle}
        </span>
      </legend>
      <div
        className="credit-plan-scenario-grid"
        role="radiogroup"
        aria-label={messages.scenarioControlLabel}
      >
        {scenarioKeys.map((key) => {
          const scenario = result.scenarios.find((candidate) => candidate.key === key);
          if (scenario === undefined) {
            throw new Error(`Plan result does not contain scenario ${key}`);
          }

          const status = scenario.comparison?.status ?? null;
          const label = messages.scenarioLabel(key);
          const detailsId = `${groupName}-${key}-details`;
          return (
            <label
              className="credit-plan-scenario"
              data-credit-plan-selected={selectedScenarioKey === key ? "true" : "false"}
              key={key}
            >
              <input
                className="credit-plan-scenario-input"
                type="radio"
                name={groupName}
                value={key}
                checked={selectedScenarioKey === key}
                onChange={() => selectScenario(key)}
                aria-label={label}
                aria-describedby={detailsId}
              />
              <span className="credit-plan-scenario-label">{label}</span>
              <span className="credit-plan-scenario-credits">
                {messages.scenarioCreditsValue(scenario.plannedCredits)}
              </span>
              <span id={detailsId} className="credit-plan-sr-only">
                <span className={planStatusClass(status)}>
                  <span aria-hidden="true" className="credit-plan-status-symbol">
                    {planStatusSymbol(status)}
                  </span>
                  {status === null
                    ? messages.estimateOnlyStatus
                    : messages.statusText(status)}
                </span>
                <span>
                  {messages.multiplierLabel}: {messages.multiplierValue(scenario.burnMultiplier)}
                </span>
                <span>
                  {messages.plannedCreditsLabel}:{" "}
                  {messages.creditsValue(scenario.plannedCredits)}
                </span>
                <span>
                  {messages.averageDailyBurnLabel}:{" "}
                  {messages.creditsValue(scenario.averageDailyBurn)}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function CreditPlanBreakdown({ className }: CreditPlanSectionProps) {
  const { input, result, selectedScenario, headingLevel, messages } = useCreditPlan();
  const headingId = useId();
  const Heading = headingTag(nestedHeadingLevel(headingLevel));
  const scenarioLabel = messages.scenarioLabel(selectedScenario.key);
  const metricLabels = new Map(
    input.metricEstimates.map(({ key, label }) => [key, label ?? key]),
  );

  return (
    <section
      className={classNames("credit-plan-section credit-plan-breakdown", className)}
      aria-labelledby={headingId}
    >
      <Heading id={headingId} className="credit-plan-heading">
        {messages.breakdownTitle}
      </Heading>
      <div
        className="credit-plan-table-scroll"
        role="region"
        aria-label={messages.metricTableCaption(scenarioLabel)}
        tabIndex={0}
      >
        <table className="credit-plan-table credit-plan-breakdown-table">
          <caption>{messages.metricTableCaption(scenarioLabel)}</caption>
          <thead>
            <tr>
              <th scope="col">{messages.metricHeader}</th>
              <th scope="col">{messages.plannedCreditsHeader}</th>
              <th scope="col">{messages.shareHeader}</th>
            </tr>
          </thead>
          <tbody>
            {selectedScenario.metricBreakdown.map((entry) => {
              const shareRatio = boundedRatio(
                entry.plannedCredits,
                selectedScenario.plannedCredits,
              );
              const shareStyle = {
                "--credit-plan-share-fill": `${shareRatio * 100}%`,
              } as CSSProperties;

              return (
                <tr key={entry.key}>
                  <th scope="row">{metricLabels.get(entry.key) ?? entry.key}</th>
                  <td>{messages.creditsValue(entry.plannedCredits)}</td>
                  <td>
                    <span className="credit-plan-share" style={shareStyle}>
                      <span aria-hidden="true" className="credit-plan-share-bar">
                        <span className="credit-plan-share-fill" />
                      </span>
                      <span className="credit-plan-share-value">
                        {Math.round(shareRatio * 100)}%
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="credit-plan-breakdown-total">
        {messages.plannedCreditsLabel}:{" "}
        <strong>{messages.creditsValue(selectedScenario.plannedCredits)}</strong>{" "}
        <span className="credit-plan-breakdown-baseline">
          ({messages.multiplierLabel}{" "}
          {messages.multiplierValue(selectedScenario.burnMultiplier)},{" "}
          {messages.dayCount(result.daysInPeriod)})
        </span>
      </p>
    </section>
  );
}

export function CreditPlanWarnings({ className }: CreditPlanSectionProps) {
  const { result, headingLevel, messages } = useCreditPlan();
  const headingId = useId();
  const Heading = headingTag(nestedHeadingLevel(headingLevel));
  const hasComparison = result.scenarios.some(({ comparison }) => comparison !== null);

  return (
    <section
      className={classNames("credit-plan-section credit-plan-warnings", className)}
      aria-labelledby={headingId}
      aria-live="polite"
      aria-atomic="true"
    >
      <Heading id={headingId} className="credit-plan-heading">
        {messages.warningsTitle}
      </Heading>
      {result.warnings.length === 0 ? (
        <p className="credit-plan-no-warnings">
          <span aria-hidden="true" className="credit-plan-status-symbol">
            {hasComparison ? "✓" : "≈"}
          </span>
          {hasComparison ? messages.noWarnings : messages.estimateOnlyNotice}
        </p>
      ) : (
        <ul className="credit-plan-warning-list">
          {result.warnings.map((warning) => (
            <li
              className="credit-plan-warning"
              data-credit-plan-warning={warning.code}
              key={`${warning.code}-${warning.scenarioKey}`}
            >
              <span aria-hidden="true" className="credit-plan-status-symbol">!</span>
              {messages.overAllocationWarning(
                messages.scenarioLabel(warning.scenarioKey),
                warning.plannedCredits,
                warning.allocation,
                warning.shortfall,
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CreditPlanTrace({ className }: CreditPlanSectionProps) {
  const { input, result, selectedScenario, headingLevel, messages } = useCreditPlan();
  const DetailHeading = headingTag(nestedHeadingLevel(nestedHeadingLevel(headingLevel)));
  const StepHeading = headingTag(
    nestedHeadingLevel(nestedHeadingLevel(nestedHeadingLevel(headingLevel))),
  );
  const scenarioLabel = messages.scenarioLabel(selectedScenario.key);
  const comparison = selectedScenario.comparison;
  const metricLabels = new Map(
    input.metricEstimates.map(({ key, label }) => [key, label ?? key]),
  );
  const scenarioCreditsByMetric = new Map(
    selectedScenario.metricBreakdown.map(({ key, plannedCredits }) => [
      key,
      plannedCredits,
    ]),
  );

  return (
    <details
      className={classNames("credit-plan-section credit-plan-trace", className)}
    >
      <summary>{messages.calculationTraceSummary}</summary>
      <div className="credit-plan-trace-content">
        <dl className="credit-plan-trace-grid">
          <div>
            <dt>{messages.periodLabel}</dt>
            <dd>{messages.periodValue(input.period.startDate, input.period.endDate)}</dd>
          </div>
          <div>
            <dt>{messages.daysInPeriodLabel}</dt>
            <dd>{messages.dayCount(result.daysInPeriod)}</dd>
          </div>
          <div>
            <dt>{messages.multiplierLabel}</dt>
            <dd>{messages.multiplierValue(selectedScenario.burnMultiplier)}</dd>
          </div>
          <div>
            <dt>{messages.plannedCreditsLabel}</dt>
            <dd>{messages.creditsValue(selectedScenario.plannedCredits)}</dd>
          </div>
          <div>
            <dt>{messages.averageDailyBurnLabel}</dt>
            <dd>{messages.creditsValue(selectedScenario.averageDailyBurn)}</dd>
          </div>
          {comparison !== null && (
            <div>
              <dt>{messages.allocationLabel}</dt>
              <dd>{messages.creditsValue(comparison.allocation)}</dd>
            </div>
          )}
          {comparison !== null && (
            <div>
              <dt>{messages.utilizationLabel}</dt>
              <dd>{messages.percentValue(comparison.utilization)}</dd>
            </div>
          )}
          {comparison !== null && (
            <div>
              <dt>{messages.surplusLabel}</dt>
              <dd>{messages.creditsValue(comparison.surplus)}</dd>
            </div>
          )}
          {comparison !== null && (
            <div>
              <dt>{messages.shortfallLabel}</dt>
              <dd>{messages.creditsValue(comparison.shortfall)}</dd>
            </div>
          )}
          <div>
            <dt>{messages.statusLabel}</dt>
            <dd>
              {comparison === null
                ? messages.estimateOnlyStatus
                : messages.statusText(comparison.status)}
            </dd>
          </div>
        </dl>

        <div
          className="credit-plan-table-scroll"
          role="region"
          aria-label={messages.metricTableCaption(scenarioLabel)}
          tabIndex={0}
        >
          <table className="credit-plan-table">
            <caption>{messages.metricTableCaption(scenarioLabel)}</caption>
            <thead>
              <tr>
                <th scope="col">{messages.metricHeader}</th>
                <th scope="col">{messages.estimatedUnitsHeader}</th>
                <th scope="col">{messages.creditsPerUnitHeader}</th>
                <th scope="col">{messages.plannedCreditsHeader}</th>
              </tr>
            </thead>
            <tbody>
              {result.metrics.map((metric) => (
                <tr key={metric.key}>
                  <th scope="row">{metricLabels.get(metric.key) ?? metric.key}</th>
                  <td>{messages.unitsValue(metric.estimatedUnits)}</td>
                  <td>{messages.unitsValue(metric.creditsPerUnit)}</td>
                  <td>
                    {messages.creditsValue(
                      scenarioCreditsByMetric.get(metric.key) ?? metric.plannedCredits,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DetailHeading>{messages.sourceInputsTitle}</DetailHeading>
        <dl className="credit-plan-source-inputs">
          {result.calculationTrace.sourceInputs.map((source, index) => (
            <div key={`${source.path}-${index}`}>
              <dt><code>{source.path}</code></dt>
              <dd><code>{traceValue(source.value)}</code></dd>
            </div>
          ))}
        </dl>
        <DetailHeading>{messages.stepsTitle}</DetailHeading>
        <ol className="credit-plan-trace-steps">
          {result.calculationTrace.steps.map((step, index) => (
            <li key={`${step.key}-${index}`}>
              <StepHeading className="credit-plan-trace-step-heading">
                <code>{step.key}</code>
              </StepHeading>
              <dl>
                <div>
                  <dt>{messages.formulaLabel}</dt>
                  <dd><code>{step.formula}</code></dd>
                </div>
                <div>
                  <dt>{messages.operandsLabel}</dt>
                  <dd><code>{traceValue(step.operands)}</code></dd>
                </div>
                <div>
                  <dt>{messages.resultLabel}</dt>
                  <dd><code>{traceValue(step.result)}</code></dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}

export function CreditPlanActions({
  children,
  className,
}: CreditPlanActionsProps) {
  const { actions, messages } = useCreditPlan();
  const content: ReactNode = children === undefined ? actions : children;

  if (content === undefined || content === null || content === false) return null;

  return (
    <div
      className={classNames("credit-plan-actions", className)}
      aria-label={messages.actionsLabel}
      role="group"
    >
      {content}
    </div>
  );
}

export function CreditPlanView(props: CreditPlanViewProps) {
  return (
    <CreditPlanRoot {...props}>
      <div className="credit-plan-header">
        <CreditPlanTitle />
        <CreditPlanStatus />
      </div>
      <CreditPlanSummary />
      <CreditPlanScenarios />
      <CreditPlanBreakdown />
      <CreditPlanWarnings />
      <CreditPlanActions />
      <CreditPlanTrace />
    </CreditPlanRoot>
  );
}

export const CreditPlan = {
  Root: CreditPlanRoot,
  Title: CreditPlanTitle,
  Summary: CreditPlanSummary,
  Scenarios: CreditPlanScenarios,
  Breakdown: CreditPlanBreakdown,
  Warnings: CreditPlanWarnings,
  Actions: CreditPlanActions,
  Trace: CreditPlanTrace,
  View: CreditPlanView,
};
