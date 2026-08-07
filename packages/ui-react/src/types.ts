import type {
  HTMLAttributes,
  ReactNode,
} from "react";
import type {
  ForecastInput,
  ForecastResult,
  ForecastStatus,
  ScenarioForecast,
  ScenarioKey,
} from "@tansohq/credit-forecast-schema";

export type CreditBurndownHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface VersionMismatchDetails {
  inputSchemaVersion: string;
  resultSchemaVersion: string;
  inputMethodologyVersion: string;
  resultMethodologyVersion: string;
}

export interface CreditBurndownMessages {
  title: string;
  summaryTitle: string;
  scenariosTitle: string;
  scenarioControlLabel: string;
  chartTitle: string;
  warningsTitle: string;
  breakdownTitle: string;
  actionsLabel: string;
  currentBalanceLabel: string;
  allocationLabel: string;
  usedToDateLabel: string;
  baselineDailyBurnLabel: string;
  endingBalanceLabel: string;
  depletionDateLabel: string;
  statusLabel: string;
  dailyBurnLabel: string;
  projectedUsageLabel: string;
  projectedConsumptionLabel: string;
  utilizationLabel: string;
  shortfallLabel: string;
  periodLabel: string;
  asOfLabel: string;
  lookbackLabel: string;
  observedTableCaption: string;
  projectedTableCaption: (scenarioLabel: string) => string;
  dateHeader: string;
  dailyUsageHeader: string;
  cumulativeUsageHeader: string;
  startBalanceHeader: string;
  balanceDeltaHeader: string;
  endingBalanceHeader: string;
  noWarnings: string;
  calculationTraceSummary: string;
  sourceInputsTitle: string;
  stepsTitle: string;
  formulaLabel: string;
  operandsLabel: string;
  resultLabel: string;
  scenarioLabel: (key: ScenarioKey) => string;
  statusText: (status: ForecastStatus) => string;
  creditsValue: (value: string) => string;
  scenarioBalanceValue: (value: string) => string;
  scenarioOutcomeBalance: (value: string) => string;
  scenarioOutcomeDepletion: (date: string) => string;
  utilizationValue: (value: string) => string;
  dayCount: (count: number) => string;
  periodValue: (startDate: string, endDate: string) => string;
  chartDescription: (scenarioLabel: string, endingBalance: string) => string;
  lowBalanceWarning: (
    scenarioLabel: string,
    endingBalance: string,
    threshold: string,
  ) => string;
  depletionWarning: (
    scenarioLabel: string,
    depletionDate: string,
    shortfall: string,
  ) => string;
  versionMismatch: (details: VersionMismatchDetails) => string;
}

export interface CreditBurndownRootProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  input: ForecastInput;
  result: ForecastResult;
  children: ReactNode;
  selectedScenario?: ScenarioKey;
  defaultSelectedScenario?: ScenarioKey;
  onSelectedScenarioChange?: (scenario: ScenarioKey) => void;
  headingLevel?: CreditBurndownHeadingLevel;
  messages?: Partial<CreditBurndownMessages>;
  actions?: ReactNode;
}

export interface CreditBurndownSectionProps {
  className?: string;
}

export interface CreditBurndownActionsProps extends CreditBurndownSectionProps {
  children?: ReactNode;
}

export type CreditBurndownViewProps = Omit<CreditBurndownRootProps, "children">;

export interface CreditBurndownContextValue {
  input: ForecastInput;
  result: ForecastResult;
  selectedScenarioKey: ScenarioKey;
  selectedScenario: ScenarioForecast;
  selectScenario: (scenario: ScenarioKey) => void;
  headingLevel: CreditBurndownHeadingLevel;
  messages: CreditBurndownMessages;
  actions?: ReactNode;
}
