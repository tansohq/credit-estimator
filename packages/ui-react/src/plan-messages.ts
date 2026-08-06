import { roundDisplayDecimal } from "./messages.js";
import type { CreditPlanMessages } from "./plan-types.js";

function shiftDecimalRightTwo(value: string): string {
  const negative = value.startsWith("-");
  const digits = negative ? value.slice(1) : value;
  const [whole = "0", fraction = ""] = digits.split(".");
  const paddedFraction = fraction.padEnd(2, "0");
  const shiftedWhole = (whole + paddedFraction.slice(0, 2)).replace(/^0+(?=\d)/u, "");
  const shiftedFraction = paddedFraction.slice(2);
  const magnitude = shiftedFraction === ""
    ? shiftedWhole
    : `${shiftedWhole}.${shiftedFraction}`;
  return negative ? `-${magnitude}` : magnitude;
}

export const defaultCreditPlanMessages: CreditPlanMessages = {
  title: "Credit plan estimate",
  summaryTitle: "Plan summary",
  scenariosTitle: "Usage scenarios",
  scenarioControlLabel: "Select a usage scenario",
  breakdownTitle: "Where credits go",
  warningsTitle: "Plan warnings",
  actionsLabel: "Plan actions",
  plannedCreditsLabel: "Estimated credits needed",
  averageDailyBurnLabel: "Average daily burn",
  allocationLabel: "Candidate allocation",
  utilizationLabel: "Allocation used",
  surplusLabel: "Credits to spare",
  shortfallLabel: "Additional credits needed",
  periodLabel: "Plan period",
  daysInPeriodLabel: "Days in period",
  multiplierLabel: "Scenario multiplier",
  statusLabel: "Status",
  meterLabel: "Allocation usage",
  metricHeader: "Metric",
  estimatedUnitsHeader: "Estimated units",
  creditsPerUnitHeader: "Credits per unit",
  plannedCreditsHeader: "Planned credits",
  shareHeader: "Share of plan",
  metricTableCaption: (scenarioLabel) =>
    `Planned credits by metric for the ${scenarioLabel} scenario`,
  noWarnings: "Every scenario fits within the candidate allocation.",
  estimateOnlyNotice:
    "No candidate allocation supplied. Add one to compare scenarios against a commitment.",
  estimateOnlyStatus: "Estimate only",
  calculationTraceSummary: "How this plan was calculated",
  sourceInputsTitle: "Source inputs",
  stepsTitle: "Calculation steps",
  formulaLabel: "Formula",
  operandsLabel: "Operands",
  resultLabel: "Result",
  scenarioLabel: (key) =>
    ({ low: "Conservative", base: "Expected", high: "Aggressive" })[key],
  statusText: (status) =>
    ({
      WITHIN_ALLOCATION: "Fits allocation",
      OVER_ALLOCATION: "Exceeds allocation",
    })[status],
  creditsValue: (value) => `${roundDisplayDecimal(value)} credits`,
  scenarioCreditsValue: (value) => roundDisplayDecimal(value),
  unitsValue: (value) => roundDisplayDecimal(value),
  percentValue: (decimalRatio) =>
    `${roundDisplayDecimal(shiftDecimalRightTwo(decimalRatio))}%`,
  multiplierValue: (value) => `${roundDisplayDecimal(value)}×`,
  dayCount: (count) => `${count} ${count === 1 ? "day" : "days"}`,
  periodValue: (startDate, endDate) => `${startDate} to ${endDate} (end exclusive)`,
  meterDescription: (scenarioLabel, utilizationPercent, allocation) =>
    `${scenarioLabel} scenario uses ${utilizationPercent} of the ${roundDisplayDecimal(allocation)}-credit candidate allocation.`,
  overAllocationWarning: (scenarioLabel, plannedCredits, allocation, shortfall) =>
    `${scenarioLabel} scenario needs ${roundDisplayDecimal(plannedCredits)} credits — ${roundDisplayDecimal(shortfall)} more than the ${roundDisplayDecimal(allocation)}-credit candidate allocation.`,
  versionMismatch: ({
    inputSchemaVersion,
    resultSchemaVersion,
    inputMethodologyVersion,
    resultMethodologyVersion,
  }) =>
    `Plan input and result versions do not match. Input schema ${inputSchemaVersion}, result schema ${resultSchemaVersion}; input methodology ${inputMethodologyVersion}, result methodology ${resultMethodologyVersion}.`,
};

export function resolveCreditPlanMessages(
  overrides: Partial<CreditPlanMessages> | undefined,
): CreditPlanMessages {
  return { ...defaultCreditPlanMessages, ...overrides };
}
