import type {
  HTMLAttributes,
  ReactNode,
} from "react";
import type {
  PlanInput,
  PlanResult,
  PlanStatus,
  ScenarioKey,
  ScenarioPlan,
} from "@tansohq/credit-forecast-schema";

import type {
  CreditBurndownHeadingLevel,
  VersionMismatchDetails,
} from "./types.js";

export interface CreditPlanMessages {
  title: string;
  summaryTitle: string;
  scenariosTitle: string;
  scenarioControlLabel: string;
  breakdownTitle: string;
  warningsTitle: string;
  actionsLabel: string;
  plannedCreditsLabel: string;
  averageDailyBurnLabel: string;
  allocationLabel: string;
  utilizationLabel: string;
  surplusLabel: string;
  shortfallLabel: string;
  periodLabel: string;
  daysInPeriodLabel: string;
  multiplierLabel: string;
  statusLabel: string;
  meterLabel: string;
  metricHeader: string;
  estimatedUnitsHeader: string;
  creditsPerUnitHeader: string;
  plannedCreditsHeader: string;
  shareHeader: string;
  metricTableCaption: (scenarioLabel: string) => string;
  noWarnings: string;
  estimateOnlyNotice: string;
  estimateOnlyStatus: string;
  calculationTraceSummary: string;
  sourceInputsTitle: string;
  stepsTitle: string;
  formulaLabel: string;
  operandsLabel: string;
  resultLabel: string;
  scenarioLabel: (key: ScenarioKey) => string;
  statusText: (status: PlanStatus) => string;
  creditsValue: (value: string) => string;
  scenarioCreditsValue: (value: string) => string;
  unitsValue: (value: string) => string;
  percentValue: (decimalRatio: string) => string;
  multiplierValue: (value: string) => string;
  dayCount: (count: number) => string;
  periodValue: (startDate: string, endDate: string) => string;
  meterDescription: (
    scenarioLabel: string,
    utilizationPercent: string,
    allocation: string,
  ) => string;
  overAllocationWarning: (
    scenarioLabel: string,
    plannedCredits: string,
    allocation: string,
    shortfall: string,
  ) => string;
  versionMismatch: (details: VersionMismatchDetails) => string;
}

export interface CreditPlanRootProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  input: PlanInput;
  result: PlanResult;
  children: ReactNode;
  selectedScenario?: ScenarioKey;
  defaultSelectedScenario?: ScenarioKey;
  onSelectedScenarioChange?: (scenario: ScenarioKey) => void;
  headingLevel?: CreditBurndownHeadingLevel;
  messages?: Partial<CreditPlanMessages>;
  actions?: ReactNode;
}

export interface CreditPlanSectionProps {
  className?: string;
}

export interface CreditPlanActionsProps extends CreditPlanSectionProps {
  children?: ReactNode;
}

export type CreditPlanViewProps = Omit<CreditPlanRootProps, "children">;

export interface CreditPlanContextValue {
  input: PlanInput;
  result: PlanResult;
  selectedScenarioKey: ScenarioKey;
  selectedScenario: ScenarioPlan;
  selectScenario: (scenario: ScenarioKey) => void;
  headingLevel: CreditBurndownHeadingLevel;
  messages: CreditPlanMessages;
  actions?: ReactNode;
}
