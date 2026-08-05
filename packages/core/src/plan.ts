import type {
  CalculationStep,
  PlanAllocationComparison,
  PlanInput,
  PlanMetricCredits,
  PlanResult,
  PlanScenarioMetricCredits,
  PlanStatus,
  PlanWarning,
  ScenarioKey,
  ScenarioPlan,
  SourceInputTrace,
} from "@tansohq/credit-forecast-schema";
import { Decimal } from "decimal.js";

import { calendarDates } from "./calendar.js";
import { parseAndValidatePlanInput } from "./validation.js";

const decimalInputs = (input: PlanInput): readonly string[] => [
  ...(input.allocation === undefined ? [] : [input.allocation]),
  ...input.metricEstimates.flatMap(({ estimatedUnits, creditsPerUnit }) => [
    estimatedUnits,
    creditsPerUnit,
  ]),
  ...input.scenarios.map(({ burnMultiplier }) => burnMultiplier),
];

const decimalPrecision = (input: PlanInput): number => {
  const longestInput = Math.max(
    ...decimalInputs(input).map((value) => value.replace(/[-.]/g, "").length),
  );
  const operationGrowth = String(input.metricEstimates.length + 1).length;
  return Math.max(40, longestInput * 2 + operationGrowth + 30);
};

const sourceInputs = (input: PlanInput): readonly SourceInputTrace[] => [
  { path: "input.schemaVersion", value: input.schemaVersion },
  { path: "input.methodologyVersion", value: input.methodologyVersion },
  { path: "input.period.startDate", value: input.period.startDate },
  { path: "input.period.endDate", value: input.period.endDate },
  { path: "input.allocation", value: input.allocation ?? null },
  {
    path: "input.metricEstimates",
    value: input.metricEstimates.map(({ key, label, estimatedUnits, creditsPerUnit }) => ({
      key,
      ...(label === undefined ? {} : { label }),
      estimatedUnits,
      creditsPerUnit,
    })),
  },
  {
    path: "input.scenarios[0].burnMultiplier",
    value: input.scenarios[0]?.burnMultiplier ?? null,
  },
  {
    path: "input.scenarios[1].burnMultiplier",
    value: input.scenarios[1]?.burnMultiplier ?? null,
  },
  {
    path: "input.scenarios[2].burnMultiplier",
    value: input.scenarios[2]?.burnMultiplier ?? null,
  },
];

interface ScenarioPlanCalculation {
  readonly plan: ScenarioPlan;
  readonly steps: readonly CalculationStep[];
}

export const planCreditUsage = (rawInput: unknown): PlanResult => {
  const input = parseAndValidatePlanInput(rawInput);
  const DecimalType = Decimal.clone({
    precision: decimalPrecision(input),
    rounding: Decimal.ROUND_HALF_UP,
    toExpNeg: -1_000_000_000,
    toExpPos: 1_000_000_000,
  });
  const decimal = (value: string | number): Decimal => new DecimalType(value);
  const rounded = (value: Decimal): Decimal =>
    value.toDecimalPlaces(12, Decimal.ROUND_HALF_UP);
  const formatted = (value: Decimal): string => {
    const result = rounded(value).toFixed();
    return result === "-0" ? "0" : result;
  };

  const metrics: PlanMetricCredits[] = input.metricEstimates.map(
    ({ key, label, estimatedUnits, creditsPerUnit }) => ({
      key,
      ...(label === undefined ? {} : { label }),
      estimatedUnits,
      creditsPerUnit,
      plannedCredits: formatted(
        rounded(decimal(estimatedUnits).times(decimal(creditsPerUnit))),
      ),
    }),
  );
  const baselinePlannedCredits = formatted(
    metrics.reduce((total, metric) => total.plus(decimal(metric.plannedCredits)), decimal(0)),
  );
  const daysInPeriod = calendarDates(input.period.startDate, input.period.endDate).length;
  const baselineAverageDailyBurn = formatted(
    rounded(decimal(baselinePlannedCredits).dividedBy(daysInPeriod)),
  );

  const commonSteps: CalculationStep[] = [
    ...metrics.map((metric) => ({
      key: `metrics.${metric.key}.plannedCredits`,
      formula: "estimatedUnits * creditsPerUnit",
      operands: {
        estimatedUnits: metric.estimatedUnits,
        creditsPerUnit: metric.creditsPerUnit,
      },
      result: metric.plannedCredits,
    })),
    {
      key: "baselinePlannedCredits",
      formula: "sum(metrics[*].plannedCredits)",
      operands: {
        metricPlannedCredits: metrics.map(({ plannedCredits }) => plannedCredits),
      },
      result: baselinePlannedCredits,
    },
    {
      key: "daysInPeriod",
      formula: "calendar_days_in_[period.startDate,period.endDate)",
      operands: {
        periodStartDate: input.period.startDate,
        periodEndDate: input.period.endDate,
      },
      result: daysInPeriod,
    },
    {
      key: "baselineAverageDailyBurn",
      formula: "baselinePlannedCredits / daysInPeriod",
      operands: { baselinePlannedCredits, daysInPeriod },
      result: baselineAverageDailyBurn,
    },
  ];

  const calculateScenario = (scenarioKey: ScenarioKey): ScenarioPlanCalculation => {
    const scenario = input.scenarios.find(({ key }) => key === scenarioKey);
    if (scenario === undefined) {
      throw new Error(`Validated scenario ${scenarioKey} is missing`);
    }

    const metricBreakdown: PlanScenarioMetricCredits[] = metrics.map((metric) => ({
      key: metric.key,
      plannedCredits: formatted(
        rounded(decimal(metric.plannedCredits).times(decimal(scenario.burnMultiplier))),
      ),
    }));
    const plannedCredits = formatted(
      metricBreakdown.reduce(
        (total, entry) => total.plus(decimal(entry.plannedCredits)),
        decimal(0),
      ),
    );
    const averageDailyBurn = formatted(
      rounded(decimal(plannedCredits).dividedBy(daysInPeriod)),
    );

    const steps: CalculationStep[] = [
      {
        key: `${scenarioKey}.metricBreakdown`,
        formula: "metricPlannedCredits * burnMultiplier",
        operands: {
          burnMultiplier: scenario.burnMultiplier,
          metricPlannedCredits: metrics.map(({ plannedCredits: value }) => value),
        },
        result: metricBreakdown.map(({ plannedCredits: value }) => value),
      },
      {
        key: `${scenarioKey}.plannedCredits`,
        formula: "sum(metricBreakdown[*].plannedCredits)",
        operands: {
          breakdownPlannedCredits: metricBreakdown.map(
            ({ plannedCredits: value }) => value,
          ),
        },
        result: plannedCredits,
      },
      {
        key: `${scenarioKey}.averageDailyBurn`,
        formula: "plannedCredits / daysInPeriod",
        operands: { plannedCredits, daysInPeriod },
        result: averageDailyBurn,
      },
    ];

    let comparison: PlanAllocationComparison | null = null;
    if (input.allocation !== undefined) {
      const allocation = input.allocation;
      const utilization = formatted(
        rounded(decimal(plannedCredits).dividedBy(decimal(allocation))),
      );
      const difference = rounded(decimal(plannedCredits).minus(decimal(allocation)));
      const shortfall = formatted(difference.greaterThan(0) ? difference : decimal(0));
      const surplus = formatted(
        difference.lessThan(0) ? difference.negated() : decimal(0),
      );
      const status: PlanStatus = difference.greaterThan(0)
        ? "OVER_ALLOCATION"
        : "WITHIN_ALLOCATION";
      comparison = { allocation, utilization, surplus, shortfall, status };
      steps.push(
        {
          key: `${scenarioKey}.utilization`,
          formula: "plannedCredits / allocation",
          operands: { plannedCredits, allocation },
          result: utilization,
        },
        {
          key: `${scenarioKey}.surplus`,
          formula: "max(0, allocation - plannedCredits)",
          operands: { plannedCredits, allocation },
          result: surplus,
        },
        {
          key: `${scenarioKey}.shortfall`,
          formula: "max(0, plannedCredits - allocation)",
          operands: { plannedCredits, allocation },
          result: shortfall,
        },
        {
          key: `${scenarioKey}.status`,
          formula: "status_from_planned_credits_and_allocation",
          operands: { plannedCredits, allocation },
          result: status,
        },
      );
    }

    return {
      plan: {
        key: scenarioKey,
        burnMultiplier: scenario.burnMultiplier,
        plannedCredits,
        averageDailyBurn,
        metricBreakdown,
        comparison,
      },
      steps,
    };
  };

  const calculations = (["low", "base", "high"] as const).map(calculateScenario);
  const scenarios = calculations.map(({ plan }) => plan);
  const warnings: PlanWarning[] = [];
  scenarios.forEach((scenario) => {
    if (scenario.comparison?.status === "OVER_ALLOCATION") {
      warnings.push({
        code: "OVER_ALLOCATION",
        scenarioKey: scenario.key,
        plannedCredits: scenario.plannedCredits,
        allocation: scenario.comparison.allocation,
        shortfall: scenario.comparison.shortfall,
      });
    }
  });
  const traceOrder = [
    calculations[1],
    calculations[0],
    calculations[2],
  ].flatMap((calculation) => calculation?.steps ?? []);

  return {
    schemaVersion: input.schemaVersion,
    methodologyVersion: input.methodologyVersion,
    daysInPeriod,
    baselinePlannedCredits,
    baselineAverageDailyBurn,
    metrics,
    scenarios,
    warnings,
    calculationTrace: {
      sourceInputs: sourceInputs(input),
      steps: [...commonSteps, ...traceOrder],
    },
  };
};
