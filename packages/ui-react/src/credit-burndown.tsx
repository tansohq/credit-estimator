import {
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type {
  ForecastStatus,
  ForecastWarning,
  ScenarioKey,
  TraceValue,
} from "@tanso-hq/credit-forecast-schema";

import { CreditBurndownContext, useCreditBurndown } from "./context.js";
import { resolveCreditBurndownMessages } from "./messages.js";
import type {
  CreditBurndownActionsProps,
  CreditBurndownHeadingLevel,
  CreditBurndownRootProps,
  CreditBurndownSectionProps,
  CreditBurndownViewProps,
} from "./types.js";

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

function statusClass(status: ForecastStatus): string {
  return `credit-burndown-status credit-burndown-status--${status.toLowerCase().replaceAll("_", "-")}`;
}

function statusSymbol(status: ForecastStatus): string {
  if (status === "ON_TRACK") return "✓";
  if (status === "LOW_BALANCE_PROJECTED") return "!";
  return "×";
}

function traceValue(value: TraceValue): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function warningText(
  warning: ForecastWarning,
  scenarioLabel: string,
  messages: ReturnType<typeof resolveCreditBurndownMessages>,
): string {
  if (warning.code === "DEPLETION_PROJECTED") {
    return messages.depletionWarning(
      scenarioLabel,
      warning.depletionDate,
      warning.shortfall,
    );
  }

  return messages.lowBalanceWarning(
    scenarioLabel,
    warning.endingBalance,
    warning.threshold,
  );
}

export function CreditBurndownRoot({
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
}: CreditBurndownRootProps) {
  const [internalScenario, setInternalScenario] = useState(defaultSelectedScenario);
  const messages = useMemo(
    () => resolveCreditBurndownMessages(messageOverrides),
    [messageOverrides],
  );

  const versionsMatch =
    input.schemaVersion === result.schemaVersion &&
    input.methodologyVersion === result.methodologyVersion;

  if (!versionsMatch) {
    return (
      <div
        {...divProps}
        className={classNames("credit-burndown-root credit-burndown-version-error", className)}
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
    throw new Error(`Forecast result does not contain scenario ${selectedScenarioKey}`);
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
    <CreditBurndownContext.Provider value={context}>
      <div
        {...divProps}
        className={classNames("credit-burndown-root", className)}
        data-credit-burndown-status={scenario.status}
        role={divProps.role ?? "region"}
        aria-label={
          divProps["aria-label"] ??
          (divProps["aria-labelledby"] === undefined ? messages.title : undefined)
        }
      >
        {children}
      </div>
    </CreditBurndownContext.Provider>
  );
}

export function CreditBurndownSummary({ className }: CreditBurndownSectionProps) {
  const { input, result, selectedScenario, headingLevel, messages } = useCreditBurndown();
  const headingId = useId();
  const Heading = headingTag(nestedHeadingLevel(headingLevel));
  const scenarioLabel = messages.scenarioLabel(selectedScenario.key);
  const outcomeLabel = selectedScenario.depletionDate === null
    ? messages.endingBalanceLabel
    : messages.depletionDateLabel;
  const outcomeValue = selectedScenario.depletionDate === null
    ? messages.creditsValue(selectedScenario.endingBalance)
    : selectedScenario.depletionDate;

  return (
    <section
      className={classNames("credit-burndown-section credit-burndown-summary", className)}
      aria-labelledby={headingId}
    >
      <Heading id={headingId} className="credit-burndown-sr-only">
        {messages.summaryTitle}
      </Heading>
      <div className="credit-burndown-outcome">
        <span className="credit-burndown-outcome-scenario">{scenarioLabel}</span>
        <span className="credit-burndown-outcome-label">{outcomeLabel}</span>
        <strong>{outcomeValue}</strong>
      </div>
      <dl className="credit-burndown-summary-grid">
        <div className="credit-burndown-stat">
          <dt>{messages.currentBalanceLabel}</dt>
          <dd>{messages.creditsValue(input.balance.current)}</dd>
        </div>
        <div className="credit-burndown-stat">
          <dt>{messages.usedToDateLabel}</dt>
          <dd>{messages.creditsValue(result.creditsUsedToDate)}</dd>
        </div>
        <div className="credit-burndown-stat">
          <dt>{messages.baselineDailyBurnLabel}</dt>
          <dd>{messages.creditsValue(result.baselineDailyBurn)}</dd>
        </div>
        <div className="credit-burndown-stat">
          <dt>{messages.periodLabel}</dt>
          <dd>{messages.periodValue(input.period.startDate, input.period.endDate)}</dd>
        </div>
      </dl>
    </section>
  );
}

export function CreditBurndownScenarios({ className }: CreditBurndownSectionProps) {
  const {
    result,
    selectedScenarioKey,
    selectScenario,
    headingLevel,
    messages,
  } = useCreditBurndown();
  const groupName = useId();
  const sectionHeadingLevel = nestedHeadingLevel(headingLevel);

  return (
    <fieldset
      className={classNames("credit-burndown-section credit-burndown-scenarios", className)}
    >
      <legend className="credit-burndown-heading">
        <span role="heading" aria-level={sectionHeadingLevel}>
          {messages.scenariosTitle}
        </span>
      </legend>
      <div
        className="credit-burndown-scenario-grid"
        role="radiogroup"
        aria-label={messages.scenarioControlLabel}
      >
        {scenarioKeys.map((key) => {
          const scenario = result.scenarios.find((candidate) => candidate.key === key);
          if (scenario === undefined) {
            throw new Error(`Forecast result does not contain scenario ${key}`);
          }

          const label = messages.scenarioLabel(key);
          const detailsId = `${groupName}-${key}-details`;
          return (
            <label
              className="credit-burndown-scenario"
              data-credit-burndown-selected={selectedScenarioKey === key ? "true" : "false"}
              key={key}
            >
              <input
                className="credit-burndown-scenario-input"
                type="radio"
                name={groupName}
                value={key}
                checked={selectedScenarioKey === key}
                onChange={() => selectScenario(key)}
                aria-label={label}
                aria-describedby={detailsId}
              />
              <span className="credit-burndown-scenario-label">{label}</span>
              <span className="credit-burndown-scenario-balance">
                {messages.scenarioBalanceValue(scenario.endingBalance)}
              </span>
              <span id={detailsId} className="credit-burndown-sr-only">
                <span className={statusClass(scenario.status)}>
                  <span aria-hidden="true" className="credit-burndown-status-symbol">
                    {statusSymbol(scenario.status)}
                  </span>
                  {messages.statusText(scenario.status)}
                </span>
                <span>
                  {messages.dailyBurnLabel}: {messages.creditsValue(scenario.dailyBurn)}
                </span>
                <span>
                  {messages.endingBalanceLabel}: {messages.creditsValue(scenario.endingBalance)}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

interface ChartCoordinates {
  points: string;
  areaPath: string;
  zeroY: number;
  thresholdY: number;
  firstX: number;
  firstY: number;
  lastX: number;
  lastY: number;
}

const chartDecimalScale = 1_000_000_000_000n;
const chartRatioScale = 1_000_000n;

function decimalToScaledInteger(value: string): bigint {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const scaled =
    BigInt(whole) * chartDecimalScale +
    BigInt(fraction.padEnd(12, "0") || "0");
  return negative ? -scaled : scaled;
}

function chartCoordinates(
  values: readonly string[],
  thresholdValue: string,
  left: number,
  right: number,
  top: number,
  bottom: number,
): ChartCoordinates {
  const scaledValues = values.map(decimalToScaledInteger);
  const scaledThreshold = decimalToScaledInteger(thresholdValue);
  let minimum = 0n;
  let maximum = 0n;
  for (const value of [...scaledValues, scaledThreshold]) {
    if (value < minimum) minimum = value;
    if (value > maximum) maximum = value;
  }
  const span = maximum - minimum || 1n;
  const denominator = Math.max(1, scaledValues.length - 1);
  const y = (value: bigint) => {
    const ratio = Number(((value - minimum) * chartRatioScale) / span) /
      Number(chartRatioScale);
    return bottom - ratio * (bottom - top);
  };
  const projectedPoints = scaledValues.map((value, index) => ({
    x: left + (index / denominator) * (right - left),
    y: y(value),
  }));
  const first = projectedPoints[0];
  const last = projectedPoints.at(-1);

  if (first === undefined || last === undefined) {
    throw new Error("Chart requires at least one projected balance value");
  }

  const zeroY = y(0n);
  const areaPath = [
    `M ${first.x},${zeroY}`,
    ...projectedPoints.map(({ x, y: pointY }) => `L ${x},${pointY}`),
    `L ${last.x},${zeroY}`,
    "Z",
  ].join(" ");

  return {
    points: projectedPoints.map(({ x, y: pointY }) => `${x},${pointY}`).join(" "),
    areaPath,
    zeroY,
    thresholdY: y(scaledThreshold),
    firstX: first.x,
    firstY: first.y,
    lastX: last.x,
    lastY: last.y,
  };
}

export function CreditBurndownChart({ className }: CreditBurndownSectionProps) {
  const { input, result, selectedScenario, headingLevel, messages } = useCreditBurndown();
  const headingId = useId();
  const chartTitleId = useId();
  const chartDescriptionId = useId();
  const chartDataId = useId();
  const Heading = headingTag(nestedHeadingLevel(headingLevel));
  const scenarioLabel = messages.scenarioLabel(selectedScenario.key);
  const chartViewBoxWidth = 760;
  const chartLeft = 32;
  const chartRight = 728;
  const timelineWidth = chartRight - chartLeft;
  const observedDayCount = result.observedPoints.length;
  const totalDayCount = observedDayCount + result.daysRemaining;
  const forecastStartRatio = observedDayCount / totalDayCount;
  const forecastStartX = chartLeft + forecastStartRatio * timelineWidth;
  const coordinates = chartCoordinates(
    [input.balance.current, ...selectedScenario.points.map(({ endingBalance }) => endingBalance)],
    input.period.lowBalanceThreshold,
    forecastStartX,
    chartRight,
    36,
    142,
  );
  const observedValues = result.observedPoints.map(({ creditsUsed }) =>
    decimalToScaledInteger(creditsUsed));
  const maximumObserved = observedValues.reduce(
    (maximum, value) => value > maximum ? value : maximum,
    0n,
  ) || 1n;
  const observedSlotWidth = (forecastStartX - chartLeft) / observedDayCount;
  const observedBarWidth = Math.max(2, Math.min(14, observedSlotWidth * 0.48));
  const forecastStartViewBoxRatio = forecastStartX / chartViewBoxWidth;
  const forecastStartLabelAlignment = forecastStartViewBoxRatio < 0.25
    ? "start"
    : forecastStartViewBoxRatio > 0.75
      ? "end"
      : "center";
  const chartContextStyle = {
    "--credit-burndown-forecast-start-position": `${forecastStartViewBoxRatio * 100}%`,
  } as CSSProperties;

  return (
    <section
      className={classNames("credit-burndown-section credit-burndown-chart", className)}
      aria-labelledby={headingId}
    >
      <Heading id={headingId} className="credit-burndown-heading">
        {messages.chartTitle}
      </Heading>
      <p className="credit-burndown-chart-summary" id={chartDescriptionId}>
        {messages.chartDescription(scenarioLabel, selectedScenario.endingBalance)}
      </p>
      <div className="credit-burndown-chart-legend" aria-hidden="true">
        <span>
          <span className="credit-burndown-chart-key credit-burndown-chart-key--observed" />
          {messages.observedTableCaption}
        </span>
        <span>
          <span className="credit-burndown-chart-key credit-burndown-chart-key--projected" />
          {messages.projectedTableCaption(scenarioLabel)}
        </span>
      </div>
      <svg
        className="credit-burndown-chart-svg"
        viewBox="0 0 760 226"
        role="img"
        aria-labelledby={chartTitleId}
        aria-describedby={`${chartDescriptionId} ${chartDataId}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <title id={chartTitleId}>{messages.chartTitle}</title>
        <rect
          className="credit-burndown-chart-observed-zone"
          x={chartLeft}
          y="28"
          width={forecastStartX - chartLeft}
          height="190"
        />
        <rect
          className="credit-burndown-chart-projected-zone"
          x={forecastStartX}
          y="28"
          width={chartRight - forecastStartX}
          height="190"
        />
        {observedValues.map((value, index) => {
          const heightRatio = Number((value * chartRatioScale) / maximumObserved) /
            Number(chartRatioScale);
          const x = chartLeft + observedSlotWidth * index +
            (observedSlotWidth - observedBarWidth) / 2;
          const height = heightRatio * 48;

          return (
            <rect
              className="credit-burndown-chart-observed-bar"
              x={x}
              y={204 - height}
              width={observedBarWidth}
              height={height}
              rx={observedBarWidth / 2}
              key={result.observedPoints[index]?.date}
            />
          );
        })}
        <line
          className="credit-burndown-chart-zero"
          x1={forecastStartX}
          x2={chartRight}
          y1={coordinates.zeroY}
          y2={coordinates.zeroY}
        />
        <line
          className="credit-burndown-chart-threshold"
          x1={forecastStartX}
          x2={chartRight}
          y1={coordinates.thresholdY}
          y2={coordinates.thresholdY}
        />
        <path className="credit-burndown-chart-area" d={coordinates.areaPath} />
        <polyline
          className="credit-burndown-chart-line"
          points={coordinates.points}
          fill="none"
        />
        <circle
          className="credit-burndown-chart-point"
          cx={coordinates.firstX}
          cy={coordinates.firstY}
          r="4"
        />
        <circle
          className="credit-burndown-chart-point"
          cx={coordinates.lastX}
          cy={coordinates.lastY}
          r="4"
        />
        <line
          className="credit-burndown-chart-forecast-start"
          x1={forecastStartX}
          x2={forecastStartX}
          y1="12"
          y2="224"
        />
        <line
          className="credit-burndown-chart-horizon"
          x1={chartLeft}
          x2={chartRight}
          y1="224"
          y2="224"
        />
      </svg>
      <div className="credit-burndown-sr-only" id={chartDataId}>
        <p>{messages.observedTableCaption}</p>
        <ul>
          {result.observedPoints.map((point) => (
            <li key={point.date}>
              {messages.dateHeader}: {point.date}. {messages.dailyUsageHeader}:{" "}
              {messages.creditsValue(point.creditsUsed)}.{" "}
              {messages.cumulativeUsageHeader}:{" "}
              {messages.creditsValue(point.cumulativeCreditsUsed)}.
            </li>
          ))}
        </ul>
        <p>{messages.projectedTableCaption(scenarioLabel)}</p>
        <ul>
          {selectedScenario.points.map((point) => (
            <li key={point.date}>
              {messages.dateHeader}: {point.date}. {messages.startBalanceHeader}:{" "}
              {messages.creditsValue(point.startBalance)}. {messages.balanceDeltaHeader}:{" "}
              {messages.creditsValue(point.balanceDelta)}. {messages.dailyUsageHeader}:{" "}
              {messages.creditsValue(point.creditsUsed)}. {messages.endingBalanceHeader}:{" "}
              {messages.creditsValue(point.endingBalance)}.
            </li>
          ))}
        </ul>
      </div>
      <dl className="credit-burndown-chart-context" style={chartContextStyle}>
        <div>
          <dt className="credit-burndown-sr-only">{messages.periodLabel}</dt>
          <dd>{input.period.startDate}</dd>
        </div>
        <div
          className="credit-burndown-chart-context-forecast-start"
          data-credit-burndown-alignment={forecastStartLabelAlignment}
        >
          <dt>{messages.asOfLabel}</dt>
          <dd>{result.asOf}</dd>
        </div>
        <div className="credit-burndown-chart-context-end">
          <dt className="credit-burndown-sr-only">{messages.periodLabel}</dt>
          <dd>{input.period.endDate}</dd>
        </div>
      </dl>
    </section>
  );
}

export function CreditBurndownWarnings({ className }: CreditBurndownSectionProps) {
  const { result, headingLevel, messages } = useCreditBurndown();
  const headingId = useId();
  const Heading = headingTag(nestedHeadingLevel(headingLevel));

  return (
    <section
      className={classNames("credit-burndown-section credit-burndown-warnings", className)}
      aria-labelledby={headingId}
      aria-live="polite"
      aria-atomic="true"
    >
      <Heading id={headingId} className="credit-burndown-heading">
        {messages.warningsTitle}
      </Heading>
      {result.warnings.length === 0 ? (
        <p className="credit-burndown-no-warnings">
          <span aria-hidden="true" className="credit-burndown-status-symbol">✓</span>
          {messages.noWarnings}
        </p>
      ) : (
        <ul className="credit-burndown-warning-list">
          {result.warnings.map((warning) => (
            <li
              className="credit-burndown-warning"
              data-credit-burndown-warning={warning.code}
              key={`${warning.code}-${warning.scenarioKey}`}
            >
              <span aria-hidden="true" className="credit-burndown-status-symbol">!</span>
              {warningText(
                warning,
                messages.scenarioLabel(warning.scenarioKey),
                messages,
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CreditBurndownBreakdown({ className }: CreditBurndownSectionProps) {
  const { input, result, selectedScenario, headingLevel, messages } = useCreditBurndown();
  const SectionHeading = headingTag(nestedHeadingLevel(headingLevel));
  const DetailHeading = headingTag(nestedHeadingLevel(nestedHeadingLevel(headingLevel)));
  const StepHeading = headingTag(
    nestedHeadingLevel(nestedHeadingLevel(nestedHeadingLevel(headingLevel))),
  );
  const scenarioLabel = messages.scenarioLabel(selectedScenario.key);

  return (
    <details
      className={classNames(
        "credit-burndown-section credit-burndown-breakdown credit-burndown-trace",
        className,
      )}
    >
      <summary>{messages.calculationTraceSummary}</summary>
      <div className="credit-burndown-trace-content">
        <SectionHeading className="credit-burndown-heading">
          {messages.breakdownTitle}
        </SectionHeading>
        <dl className="credit-burndown-breakdown-grid">
          <div>
            <dt>{messages.periodLabel}</dt>
            <dd>{messages.periodValue(input.period.startDate, input.period.endDate)}</dd>
          </div>
          <div>
            <dt>{messages.asOfLabel}</dt>
            <dd>{result.asOf}</dd>
          </div>
          <div>
            <dt>{messages.allocationLabel}</dt>
            <dd>{messages.creditsValue(input.period.allocation)}</dd>
          </div>
          <div>
            <dt>{messages.lookbackLabel}</dt>
            <dd>{messages.dayCount(input.lookbackDays)}</dd>
          </div>
          <div>
            <dt>{messages.dailyBurnLabel}</dt>
            <dd>{messages.creditsValue(selectedScenario.dailyBurn)}</dd>
          </div>
          <div>
            <dt>{messages.projectedUsageLabel}</dt>
            <dd>{messages.creditsValue(selectedScenario.projectedCreditsUsed)}</dd>
          </div>
          <div>
            <dt>{messages.projectedConsumptionLabel}</dt>
            <dd>{messages.creditsValue(selectedScenario.projectedPeriodConsumption)}</dd>
          </div>
          <div>
            <dt>{messages.utilizationLabel}</dt>
            <dd>{messages.utilizationValue(selectedScenario.utilization)}</dd>
          </div>
          <div>
            <dt>{messages.shortfallLabel}</dt>
            <dd>{messages.creditsValue(selectedScenario.shortfall)}</dd>
          </div>
          {selectedScenario.depletionDate !== null && (
            <div>
              <dt>{messages.depletionDateLabel}</dt>
              <dd>{selectedScenario.depletionDate}</dd>
            </div>
          )}
          <div>
            <dt>{messages.statusLabel}</dt>
            <dd>{messages.statusText(selectedScenario.status)}</dd>
          </div>
        </dl>

        <div
          className="credit-burndown-table-scroll"
          role="region"
          aria-label={messages.observedTableCaption}
          tabIndex={0}
        >
          <table className="credit-burndown-table">
            <caption>{messages.observedTableCaption}</caption>
            <thead>
              <tr>
                <th scope="col">{messages.dateHeader}</th>
                <th scope="col">{messages.dailyUsageHeader}</th>
                <th scope="col">{messages.cumulativeUsageHeader}</th>
              </tr>
            </thead>
            <tbody>
              {result.observedPoints.map((point) => (
                <tr key={point.date}>
                  <th scope="row">{point.date}</th>
                  <td>{messages.creditsValue(point.creditsUsed)}</td>
                  <td>{messages.creditsValue(point.cumulativeCreditsUsed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          className="credit-burndown-table-scroll"
          role="region"
          aria-label={messages.projectedTableCaption(scenarioLabel)}
          tabIndex={0}
        >
          <table className="credit-burndown-table">
            <caption>{messages.projectedTableCaption(scenarioLabel)}</caption>
            <thead>
              <tr>
                <th scope="col">{messages.dateHeader}</th>
                <th scope="col">{messages.startBalanceHeader}</th>
                <th scope="col">{messages.balanceDeltaHeader}</th>
                <th scope="col">{messages.dailyUsageHeader}</th>
                <th scope="col">{messages.endingBalanceHeader}</th>
              </tr>
            </thead>
            <tbody>
              {selectedScenario.points.map((point) => (
                <tr key={point.date}>
                  <th scope="row">{point.date}</th>
                  <td>{messages.creditsValue(point.startBalance)}</td>
                  <td>{messages.creditsValue(point.balanceDelta)}</td>
                  <td>{messages.creditsValue(point.creditsUsed)}</td>
                  <td>{messages.creditsValue(point.endingBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DetailHeading>{messages.sourceInputsTitle}</DetailHeading>
        <dl className="credit-burndown-source-inputs">
          {result.calculationTrace.sourceInputs.map((source, index) => (
            <div key={`${source.path}-${index}`}>
              <dt><code>{source.path}</code></dt>
              <dd><code>{traceValue(source.value)}</code></dd>
            </div>
          ))}
        </dl>
        <DetailHeading>{messages.stepsTitle}</DetailHeading>
        <ol className="credit-burndown-trace-steps">
          {result.calculationTrace.steps.map((step, index) => (
            <li key={`${step.key}-${index}`}>
              <StepHeading className="credit-burndown-trace-step-heading">
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

export function CreditBurndownTitle({ className }: CreditBurndownSectionProps) {
  const { headingLevel, messages } = useCreditBurndown();
  const Heading = headingTag(headingLevel);

  return (
    <Heading className={classNames("credit-burndown-title", className)}>
      {messages.title}
    </Heading>
  );
}

function CreditBurndownStatus({ className }: CreditBurndownSectionProps) {
  const { selectedScenario, messages } = useCreditBurndown();

  return (
    <div
      className={classNames(
        `${statusClass(selectedScenario.status)} credit-burndown-status-badge`,
        className,
      )}
    >
      <span aria-hidden="true" className="credit-burndown-status-symbol">
        {statusSymbol(selectedScenario.status)}
      </span>
      <span>{messages.scenarioLabel(selectedScenario.key)}</span>
      <span aria-hidden="true">·</span>
      <span>{messages.statusText(selectedScenario.status)}</span>
    </div>
  );
}

export function CreditBurndownActions({
  children,
  className,
}: CreditBurndownActionsProps) {
  const { actions, messages } = useCreditBurndown();
  const content: ReactNode = children === undefined ? actions : children;

  if (content === undefined || content === null || content === false) return null;

  return (
    <div
      className={classNames("credit-burndown-actions", className)}
      aria-label={messages.actionsLabel}
      role="group"
    >
      {content}
    </div>
  );
}

export function CreditBurndownView(props: CreditBurndownViewProps) {
  return (
    <CreditBurndownRoot {...props}>
      <div className="credit-burndown-header">
        <CreditBurndownTitle />
        <CreditBurndownStatus />
      </div>
      <CreditBurndownSummary />
      <CreditBurndownScenarios />
      <CreditBurndownChart />
      <CreditBurndownWarnings />
      <CreditBurndownActions />
      <CreditBurndownBreakdown />
    </CreditBurndownRoot>
  );
}

export const CreditBurndown = {
  Root: CreditBurndownRoot,
  Title: CreditBurndownTitle,
  Summary: CreditBurndownSummary,
  Chart: CreditBurndownChart,
  Scenarios: CreditBurndownScenarios,
  Warnings: CreditBurndownWarnings,
  Breakdown: CreditBurndownBreakdown,
  Actions: CreditBurndownActions,
  View: CreditBurndownView,
};
