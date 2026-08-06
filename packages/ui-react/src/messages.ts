import type { CreditBurndownMessages } from "./types.js";

export function roundDisplayDecimal(value: string): string {
  return roundDecimal(value);
}

function roundDecimal(value: string): string {
  const negative = value.startsWith("-");
  const digits = negative ? value.slice(1) : value;
  const [wholePart, fractionPart = ""] = digits.split(".");
  const padded = fractionPart.padEnd(3, "0");
  const keep = padded.slice(0, 2);
  const roundDigit = padded.charCodeAt(2) - 48;
  let combined = wholePart + keep;
  if (roundDigit >= 5) {
    combined = (BigInt(combined) + 1n).toString().padStart(combined.length, "0");
  }
  const wholeOut = combined.slice(0, combined.length - 2) || "0";
  const fractionOut = combined.slice(combined.length - 2).replace(/0+$/, "");
  const magnitude = fractionOut === "" ? wholeOut : `${wholeOut}.${fractionOut}`;
  return negative && BigInt(combined) !== 0n ? `-${magnitude}` : magnitude;
}

export const defaultCreditBurndownMessages: CreditBurndownMessages = {
  title: "Credit usage forecast",
  summaryTitle: "Forecast summary",
  scenariosTitle: "Usage scenarios",
  scenarioControlLabel: "Select a usage scenario",
  chartTitle: "Projected credit balance",
  warningsTitle: "Forecast warnings",
  breakdownTitle: "Calculation breakdown",
  actionsLabel: "Forecast actions",
  currentBalanceLabel: "Current balance",
  allocationLabel: "Period allocation",
  usedToDateLabel: "Used to date",
  baselineDailyBurnLabel: "Baseline daily burn",
  endingBalanceLabel: "Projected ending balance",
  depletionDateLabel: "Projected depletion date",
  statusLabel: "Status",
  dailyBurnLabel: "Daily burn",
  projectedUsageLabel: "Projected usage",
  projectedConsumptionLabel: "Projected period consumption",
  utilizationLabel: "Projected utilization",
  shortfallLabel: "Projected shortfall",
  periodLabel: "Forecast period",
  asOfLabel: "Forecast starts",
  lookbackLabel: "Lookback window",
  observedTableCaption: "Observed daily credit usage",
  projectedTableCaption: (scenarioLabel) =>
    `Projected daily balance for the ${scenarioLabel} scenario`,
  dateHeader: "Date",
  dailyUsageHeader: "Credits used",
  cumulativeUsageHeader: "Cumulative credits used",
  startBalanceHeader: "Start balance",
  balanceDeltaHeader: "Balance change",
  endingBalanceHeader: "End balance",
  noWarnings: "No forecast warnings.",
  calculationTraceSummary: "How this forecast was calculated",
  sourceInputsTitle: "Source inputs",
  stepsTitle: "Calculation steps",
  formulaLabel: "Formula",
  operandsLabel: "Operands",
  resultLabel: "Result",
  scenarioLabel: (key) => ({ low: "Low", base: "Base", high: "High" })[key],
  statusText: (status) =>
    ({
      ON_TRACK: "On track",
      LOW_BALANCE_PROJECTED: "Low balance projected",
      DEPLETION_PROJECTED: "Depletion projected",
    })[status],
  creditsValue: (value) => `${roundDecimal(value)} credits`,
  scenarioBalanceValue: (value) => roundDecimal(value),
  utilizationValue: (value) => `${roundDecimal(value)}× allocation`,
  dayCount: (count) => `${count} ${count === 1 ? "day" : "days"}`,
  periodValue: (startDate, endDate) => `${startDate} to ${endDate} (end exclusive)`,
  chartDescription: (scenarioLabel, endingBalance) =>
    `${scenarioLabel} scenario projected balance ending at ${roundDecimal(endingBalance)} credits. Exact daily values are included in the accessible chart description.`,
  lowBalanceWarning: (scenarioLabel, endingBalance, threshold) =>
    `${scenarioLabel} scenario ends with ${roundDecimal(endingBalance)} credits, at or below the ${roundDecimal(threshold)}-credit low-balance threshold.`,
  depletionWarning: (scenarioLabel, depletionDate, shortfall) =>
    `${scenarioLabel} scenario reaches depletion on ${depletionDate} and ends with a ${roundDecimal(shortfall)}-credit shortfall.`,
  versionMismatch: ({
    inputSchemaVersion,
    resultSchemaVersion,
    inputMethodologyVersion,
    resultMethodologyVersion,
  }) =>
    `Forecast input and result versions do not match. Input schema ${inputSchemaVersion}, result schema ${resultSchemaVersion}; input methodology ${inputMethodologyVersion}, result methodology ${resultMethodologyVersion}.`,
};

export function resolveCreditBurndownMessages(
  overrides: Partial<CreditBurndownMessages> | undefined,
): CreditBurndownMessages {
  return { ...defaultCreditBurndownMessages, ...overrides };
}
