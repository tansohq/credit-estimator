import type {
  CalculationStep,
  ForecastInput,
  ForecastResult,
  ForecastStatus,
  ForecastWarning,
  JsonValue,
  ObservedPoint,
  ProjectedPoint,
  ScenarioForecast,
  ScenarioKey,
  SourceInputTrace,
} from "@tanso-hq/credit-forecast-schema";
import { Decimal } from "decimal.js";

import { calendarDates } from "./calendar.js";
import { parseAndValidateForecastInput } from "./validation.js";

const decimalInputs = (input: ForecastInput): readonly string[] => [
  input.period.allocation,
  input.period.lowBalanceThreshold,
  input.balance.current,
  ...input.dailyUsage.map(({ creditsUsed }) => creditsUsed),
  ...input.balance.schedule.map(({ creditDelta }) => creditDelta),
  ...input.scenarios.map(({ burnMultiplier }) => burnMultiplier),
];

const decimalPrecision = (input: ForecastInput): number => {
  const longestInput = Math.max(
    ...decimalInputs(input).map((value) => value.replace(/[-.]/g, "").length),
  );
  const operationGrowth = String(
    input.dailyUsage.length + input.balance.schedule.length + 1,
  ).length;
  return Math.max(40, longestInput * 2 + operationGrowth + 30);
};

const asTracePoints = (points: readonly ProjectedPoint[]): readonly JsonValue[] =>
  points.map((point) => ({ ...point }));

const sourceInputs = (input: ForecastInput): readonly SourceInputTrace[] => [
  { path: "input.asOf", value: input.asOf },
  { path: "input.period.startDate", value: input.period.startDate },
  { path: "input.period.endDate", value: input.period.endDate },
  { path: "input.period.allocation", value: input.period.allocation },
  {
    path: "input.period.lowBalanceThreshold",
    value: input.period.lowBalanceThreshold,
  },
  { path: "input.lookbackDays", value: input.lookbackDays },
  { path: "input.balance.current", value: input.balance.current },
  {
    path: "input.scenarios[1].burnMultiplier",
    value: input.scenarios[1]?.burnMultiplier ?? null,
  },
  { path: "input.schemaVersion", value: input.schemaVersion },
  { path: "input.methodologyVersion", value: input.methodologyVersion },
  {
    path: "input.dailyUsage",
    value: input.dailyUsage.map(({ date, creditsUsed }) => ({ date, creditsUsed })),
  },
  {
    path: "input.balance.schedule",
    value: input.balance.schedule.map(({ date, creditDelta, reason }) => ({
      date,
      creditDelta,
      ...(reason === undefined ? {} : { reason }),
    })),
  },
  {
    path: "input.scenarios[0].burnMultiplier",
    value: input.scenarios[0]?.burnMultiplier ?? null,
  },
  {
    path: "input.scenarios[2].burnMultiplier",
    value: input.scenarios[2]?.burnMultiplier ?? null,
  },
];

interface ScenarioCalculation {
  readonly forecast: ScenarioForecast;
  readonly steps: readonly CalculationStep[];
}

export const forecastCreditUsage = (rawInput: unknown): ForecastResult => {
  const input = parseAndValidateForecastInput(rawInput);
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

  let cumulative = decimal(0);
  const observedPoints: ObservedPoint[] = input.dailyUsage.map(({ date, creditsUsed }) => {
    cumulative = rounded(cumulative.plus(decimal(creditsUsed)));
    return {
      date,
      creditsUsed,
      cumulativeCreditsUsed: formatted(cumulative),
    };
  });
  const creditsUsedToDate = formatted(cumulative);

  const lookbackUsage = input.dailyUsage
    .slice(-input.lookbackDays)
    .map(({ creditsUsed }) => creditsUsed);
  const lookbackSum = lookbackUsage.reduce(
    (total, value) => total.plus(decimal(value)),
    decimal(0),
  );
  const baselineDailyBurn = formatted(
    rounded(lookbackSum.dividedBy(input.lookbackDays)),
  );
  const projectedDates = calendarDates(input.asOf, input.period.endDate);
  const daysRemaining = projectedDates.length;

  const commonSteps: CalculationStep[] = [
    {
      key: "observedCumulativeCreditsUsed",
      formula: "cumulative[n] = cumulative[n - 1] + creditsUsed[n]",
      operands: { dailyCreditsUsed: input.dailyUsage.map(({ creditsUsed }) => creditsUsed) },
      result: observedPoints.map(({ cumulativeCreditsUsed }) => cumulativeCreditsUsed),
    },
    {
      key: "creditsUsedToDate",
      formula: "sum(dailyUsage[*].creditsUsed)",
      operands: { dailyCreditsUsed: input.dailyUsage.map(({ creditsUsed }) => creditsUsed) },
      result: creditsUsedToDate,
    },
    {
      key: "baselineDailyBurn",
      formula: "sum(lookbackCreditsUsed) / lookbackDays",
      operands: { lookbackCreditsUsed: lookbackUsage, lookbackDays: input.lookbackDays },
      result: baselineDailyBurn,
    },
    {
      key: "daysRemaining",
      formula: "calendar_days_in_[asOf,period.endDate)",
      operands: { asOf: input.asOf, periodEndDate: input.period.endDate },
      result: daysRemaining,
    },
  ];

  const calculateScenario = (scenarioKey: ScenarioKey): ScenarioCalculation => {
    const scenario = input.scenarios.find(({ key }) => key === scenarioKey);
    if (scenario === undefined) {
      throw new Error(`Validated scenario ${scenarioKey} is missing`);
    }

    const dailyBurn = formatted(
      rounded(decimal(baselineDailyBurn).times(decimal(scenario.burnMultiplier))),
    );
    const projectedCreditsUsed = formatted(
      rounded(decimal(dailyBurn).times(daysRemaining)),
    );
    const projectedPeriodConsumption = formatted(
      rounded(decimal(creditsUsedToDate).plus(decimal(projectedCreditsUsed))),
    );
    const utilization = formatted(
      rounded(decimal(projectedPeriodConsumption).dividedBy(decimal(input.period.allocation))),
    );

    let currentBalance = rounded(decimal(input.balance.current));
    let depletionDate: string | null = null;
    const points: ProjectedPoint[] = projectedDates.map((date) => {
      const startBalance = formatted(currentBalance);
      const balanceDeltaValue = input.balance.schedule
        .filter((entry) => entry.date === date)
        .reduce((total, entry) => total.plus(decimal(entry.creditDelta)), decimal(0));
      const balanceDelta = formatted(rounded(balanceDeltaValue));
      currentBalance = rounded(
        decimal(startBalance).plus(decimal(balanceDelta)).minus(decimal(dailyBurn)),
      );
      const endingBalance = formatted(currentBalance);
      if (depletionDate === null && currentBalance.lessThanOrEqualTo(0)) {
        depletionDate = date;
      }
      return { date, startBalance, balanceDelta, creditsUsed: dailyBurn, endingBalance };
    });

    const endingBalance = formatted(currentBalance);
    const shortfall = formatted(
      currentBalance.isNegative() ? rounded(currentBalance.negated()) : decimal(0),
    );
    const status: ForecastStatus =
      depletionDate !== null
        ? "DEPLETION_PROJECTED"
        : currentBalance.lessThanOrEqualTo(decimal(input.period.lowBalanceThreshold))
          ? "LOW_BALANCE_PROJECTED"
          : "ON_TRACK";
    const scheduledDeltas = input.balance.schedule.map(({ date, creditDelta }) => ({
      date,
      creditDelta,
    }));
    const endingBalances = points.map((point) => point.endingBalance);

    const steps: CalculationStep[] = [
      {
        key: `${scenarioKey}.dailyBurn`,
        formula: "baselineDailyBurn * burnMultiplier",
        operands: { baselineDailyBurn, burnMultiplier: scenario.burnMultiplier },
        result: dailyBurn,
      },
      {
        key: `${scenarioKey}.projectedCreditsUsed`,
        formula: "dailyBurn * daysRemaining",
        operands: { dailyBurn, daysRemaining },
        result: projectedCreditsUsed,
      },
      {
        key: `${scenarioKey}.projectedPeriodConsumption`,
        formula: "creditsUsedToDate + projectedCreditsUsed",
        operands: { creditsUsedToDate, projectedCreditsUsed },
        result: projectedPeriodConsumption,
      },
      {
        key: `${scenarioKey}.utilization`,
        formula: "projectedPeriodConsumption / periodAllocation",
        operands: {
          projectedPeriodConsumption,
          periodAllocation: input.period.allocation,
        },
        result: utilization,
      },
      {
        key: `${scenarioKey}.points`,
        formula: "endingBalance = startBalance + balanceDelta - creditsUsed",
        operands: {
          initialBalance: input.balance.current,
          dailyBurn,
          scheduledDeltas,
        },
        result: asTracePoints(points),
      },
      {
        key: `${scenarioKey}.depletionDate`,
        formula: "first date where endingBalance <= 0",
        operands: { endingBalances },
        result: depletionDate,
      },
      {
        key: `${scenarioKey}.shortfall`,
        formula: "max(0, -endingBalance)",
        operands: { endingBalance },
        result: shortfall,
      },
      {
        key: `${scenarioKey}.status`,
        formula: "status_from_depletion_date_ending_balance_and_threshold",
        operands: {
          depletionDate,
          endingBalance,
          lowBalanceThreshold: input.period.lowBalanceThreshold,
        },
        result: status,
      },
      {
        key: `${scenarioKey}.endingBalance`,
        formula: "last projected point endingBalance",
        operands: { endingBalances },
        result: endingBalance,
      },
    ];

    return {
      forecast: {
        key: scenarioKey,
        dailyBurn,
        projectedCreditsUsed,
        projectedPeriodConsumption,
        utilization,
        endingBalance,
        depletionDate,
        shortfall,
        status,
        points,
      },
      steps,
    };
  };

  const calculations = (["low", "base", "high"] as const).map(calculateScenario);
  const scenarios = calculations.map(({ forecast }) => forecast);
  const warnings: ForecastWarning[] = [];
  scenarios.forEach((scenario) => {
    if (scenario.depletionDate !== null) {
      warnings.push({
        code: "DEPLETION_PROJECTED",
        scenarioKey: scenario.key,
        depletionDate: scenario.depletionDate,
        shortfall: scenario.shortfall,
      });
    }
    if (
      decimal(scenario.endingBalance).greaterThan(0) &&
      decimal(scenario.endingBalance).lessThanOrEqualTo(
        decimal(input.period.lowBalanceThreshold),
      )
    ) {
      warnings.push({
        code: "LOW_BALANCE_PROJECTED",
        scenarioKey: scenario.key,
        endingBalance: scenario.endingBalance,
        threshold: input.period.lowBalanceThreshold,
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
    asOf: input.asOf,
    daysRemaining,
    creditsUsedToDate,
    baselineDailyBurn,
    observedPoints,
    scenarios,
    warnings,
    calculationTrace: {
      sourceInputs: sourceInputs(input),
      steps: [...commonSteps, ...traceOrder],
    },
  };
};
