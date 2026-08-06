export type DecimalString = string;
export type ISODate = string;
export type ScenarioKey = "low" | "base" | "high";
export type ForecastStatus =
  | "ON_TRACK"
  | "LOW_BALANCE_PROJECTED"
  | "DEPLETION_PROJECTED";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type NamespacedExtensions = Readonly<Record<string, JsonValue>>;

export interface DailyUsage {
  readonly date: ISODate;
  readonly creditsUsed: DecimalString;
}

export interface ScheduledBalanceDelta {
  readonly date: ISODate;
  readonly creditDelta: DecimalString;
  readonly reason?: string | undefined;
}

export interface ForecastScenario {
  readonly key: ScenarioKey;
  readonly burnMultiplier: DecimalString;
}

export interface ForecastInput {
  readonly schemaVersion: string;
  readonly methodologyVersion: string;
  readonly asOf: ISODate;
  readonly period: {
    readonly startDate: ISODate;
    readonly endDate: ISODate;
    readonly allocation: DecimalString;
    readonly lowBalanceThreshold: DecimalString;
  };
  readonly lookbackDays: number;
  readonly dailyUsage: readonly DailyUsage[];
  readonly balance: {
    readonly current: DecimalString;
    readonly schedule: readonly ScheduledBalanceDelta[];
  };
  readonly scenarios: readonly ForecastScenario[];
  readonly extensions?: NamespacedExtensions | undefined;
}

export interface ObservedPoint {
  readonly date: ISODate;
  readonly creditsUsed: DecimalString;
  readonly cumulativeCreditsUsed: DecimalString;
}

export interface ProjectedPoint {
  readonly date: ISODate;
  readonly startBalance: DecimalString;
  readonly balanceDelta: DecimalString;
  readonly creditsUsed: DecimalString;
  readonly endingBalance: DecimalString;
}

export interface ScenarioForecast {
  readonly key: ScenarioKey;
  readonly dailyBurn: DecimalString;
  readonly projectedCreditsUsed: DecimalString;
  readonly projectedPeriodConsumption: DecimalString;
  readonly utilization: DecimalString;
  readonly endingBalance: DecimalString;
  readonly depletionDate: ISODate | null;
  readonly shortfall: DecimalString;
  readonly status: ForecastStatus;
  readonly points: readonly ProjectedPoint[];
}

export type ForecastWarning =
  | {
      readonly code: "LOW_BALANCE_PROJECTED";
      readonly scenarioKey: ScenarioKey;
      readonly endingBalance: DecimalString;
      readonly threshold: DecimalString;
    }
  | {
      readonly code: "DEPLETION_PROJECTED";
      readonly scenarioKey: ScenarioKey;
      readonly depletionDate: ISODate;
      readonly shortfall: DecimalString;
    };

export type TraceValue = JsonValue;

export interface SourceInputTrace {
  readonly path: string;
  readonly value: TraceValue;
}

export interface CalculationStep {
  readonly key: string;
  readonly formula: string;
  readonly operands: Readonly<Record<string, TraceValue>>;
  readonly result: TraceValue;
}

export interface CalculationTrace {
  readonly sourceInputs: readonly SourceInputTrace[];
  readonly steps: readonly CalculationStep[];
}

export interface ForecastResult {
  readonly schemaVersion: string;
  readonly methodologyVersion: string;
  readonly asOf: ISODate;
  readonly daysRemaining: number;
  readonly creditsUsedToDate: DecimalString;
  readonly baselineDailyBurn: DecimalString;
  readonly observedPoints: readonly ObservedPoint[];
  readonly scenarios: readonly ScenarioForecast[];
  readonly warnings: readonly ForecastWarning[];
  readonly calculationTrace: CalculationTrace;
}

export type PlanStatus = "WITHIN_ALLOCATION" | "OVER_ALLOCATION";

export interface PlanMetricEstimate {
  readonly key: string;
  readonly label?: string | undefined;
  readonly estimatedUnits: DecimalString;
  readonly creditsPerUnit: DecimalString;
}

export interface PlanScenario {
  readonly key: ScenarioKey;
  readonly burnMultiplier: DecimalString;
}

export interface PlanInput {
  readonly schemaVersion: string;
  readonly methodologyVersion: string;
  readonly period: {
    readonly startDate: ISODate;
    readonly endDate: ISODate;
  };
  readonly metricEstimates: readonly PlanMetricEstimate[];
  readonly allocation?: DecimalString | undefined;
  readonly scenarios: readonly PlanScenario[];
  readonly extensions?: NamespacedExtensions | undefined;
}

export interface PlanMetricCredits {
  readonly key: string;
  readonly label?: string | undefined;
  readonly estimatedUnits: DecimalString;
  readonly creditsPerUnit: DecimalString;
  readonly plannedCredits: DecimalString;
}

export interface PlanScenarioMetricCredits {
  readonly key: string;
  readonly plannedCredits: DecimalString;
}

export interface PlanAllocationComparison {
  readonly allocation: DecimalString;
  readonly utilization: DecimalString;
  readonly surplus: DecimalString;
  readonly shortfall: DecimalString;
  readonly status: PlanStatus;
}

export interface ScenarioPlan {
  readonly key: ScenarioKey;
  readonly burnMultiplier: DecimalString;
  readonly plannedCredits: DecimalString;
  readonly averageDailyBurn: DecimalString;
  readonly metricBreakdown: readonly PlanScenarioMetricCredits[];
  readonly comparison: PlanAllocationComparison | null;
}

export interface PlanWarning {
  readonly code: "OVER_ALLOCATION";
  readonly scenarioKey: ScenarioKey;
  readonly plannedCredits: DecimalString;
  readonly allocation: DecimalString;
  readonly shortfall: DecimalString;
}

export interface PlanResult {
  readonly schemaVersion: string;
  readonly methodologyVersion: string;
  readonly daysInPeriod: number;
  readonly baselinePlannedCredits: DecimalString;
  readonly baselineAverageDailyBurn: DecimalString;
  readonly metrics: readonly PlanMetricCredits[];
  readonly scenarios: readonly ScenarioPlan[];
  readonly warnings: readonly PlanWarning[];
  readonly calculationTrace: CalculationTrace;
}

export interface ValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface ForecastValidationFailure {
  readonly schemaVersion: string | null;
  readonly methodologyVersion: string | null;
  readonly code: "INVALID_INPUT";
  readonly issues: readonly ValidationIssue[];
}
