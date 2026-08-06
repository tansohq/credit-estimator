import type {
  ForecastInput,
  ForecastResult,
  NamespacedExtensions,
  PlanInput,
  PlanResult,
  ValidationIssue,
} from "./types.js";

const compareAbsoluteDecimals = (left: string, right: string): number => {
  const [leftInteger = "0", leftFraction = ""] = left.split(".");
  const [rightInteger = "0", rightFraction = ""] = right.split(".");

  if (leftInteger.length !== rightInteger.length) {
    return leftInteger.length < rightInteger.length ? -1 : 1;
  }

  if (leftInteger !== rightInteger) {
    return leftInteger < rightInteger ? -1 : 1;
  }

  const paddedLeftFraction = leftFraction.padEnd(12, "0");
  const paddedRightFraction = rightFraction.padEnd(12, "0");
  if (paddedLeftFraction === paddedRightFraction) {
    return 0;
  }

  return paddedLeftFraction < paddedRightFraction ? -1 : 1;
};

export const compareDecimalStrings = (left: string, right: string): number => {
  const leftNegative = left.startsWith("-");
  const rightNegative = right.startsWith("-");

  if (leftNegative !== rightNegative) {
    return leftNegative ? -1 : 1;
  }

  const comparison = compareAbsoluteDecimals(
    leftNegative ? left.slice(1) : left,
    rightNegative ? right.slice(1) : right,
  );
  return leftNegative ? -comparison : comparison;
};

const isLeapYear = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const nextDate = (date: string): string => {
  const [yearText = "", monthText = "", dayText = ""] = date.split("-");
  let year = Number(yearText);
  let month = Number(monthText);
  let day = Number(dayText);
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  day += 1;
  if (day > (daysInMonth[month - 1] ?? 0)) {
    day = 1;
    month += 1;
  }
  if (month > 12) {
    month = 1;
    year += 1;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const datesInRange = (startDate: string, endDate: string): readonly string[] => {
  const dates: string[] = [];
  for (let date = startDate; date < endDate; date = nextDate(date)) {
    dates.push(date);
  }
  return dates;
};

const issue = (code: string, path: string, message: string): ValidationIssue => ({
  code,
  path,
  message,
});

const scenarioAssumptionIssues = (
  scenarios: readonly { readonly key: string; readonly burnMultiplier: string }[],
): readonly ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const expectedScenarioKeys = ["low", "base", "high"] as const;
  const orderedScenarios =
    scenarios.length === expectedScenarioKeys.length &&
    scenarios.every((scenario, index) => scenario.key === expectedScenarioKeys[index]);
  if (!orderedScenarios) {
    issues.push(
      issue(
        "INVALID_SCENARIO_ORDER",
        "input.scenarios",
        "scenarios must contain exactly low, base, and high in that order",
      ),
    );
  }

  scenarios.forEach((scenario, index) => {
    if (compareDecimalStrings(scenario.burnMultiplier, "0") < 0) {
      issues.push(
        issue(
          "NEGATIVE_BURN_MULTIPLIER",
          `input.scenarios[${index}].burnMultiplier`,
          "burnMultiplier must be non-negative",
        ),
      );
    }
  });

  if (orderedScenarios) {
    const [low, base, high] = scenarios;
    if (base?.burnMultiplier !== "1") {
      issues.push(
        issue(
          "INVALID_BASE_MULTIPLIER",
          "input.scenarios[1].burnMultiplier",
          'base burnMultiplier must equal "1"',
        ),
      );
    }
    if (
      low === undefined ||
      base === undefined ||
      high === undefined ||
      compareDecimalStrings(low.burnMultiplier, base.burnMultiplier) >= 0 ||
      compareDecimalStrings(base.burnMultiplier, high.burnMultiplier) >= 0
    ) {
      issues.push(
        issue(
          "INVALID_SCENARIO_MULTIPLIERS",
          "input.scenarios",
          "scenario burnMultipliers must satisfy low < base < high",
        ),
      );
    }
  }

  return issues;
};

const extensionNamespaceIssues = (
  extensions: NamespacedExtensions | undefined,
): readonly ValidationIssue[] => {
  if (extensions === undefined) {
    return [];
  }
  const issues: ValidationIssue[] = [];
  Object.keys(extensions).forEach((namespace) => {
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?)+$/u.test(namespace)) {
      issues.push(
        issue(
          "INVALID_EXTENSION_NAMESPACE",
          `input.extensions.${namespace}`,
          "extension keys must use a collision-resistant namespace",
        ),
      );
    }
  });
  return issues;
};

export const validateForecastInputSemantics = (
  input: ForecastInput,
): readonly ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  if (input.schemaVersion !== "1.0") {
    issues.push(
      issue(
        "UNSUPPORTED_SCHEMA_VERSION",
        "input.schemaVersion",
        'schemaVersion must equal "1.0"',
      ),
    );
  }
  if (input.methodologyVersion !== "1.0") {
    issues.push(
      issue(
        "UNSUPPORTED_METHODOLOGY_VERSION",
        "input.methodologyVersion",
        'methodologyVersion must equal "1.0"',
      ),
    );
  }

  const validPeriod =
    input.period.startDate < input.asOf && input.asOf < input.period.endDate;
  if (!validPeriod) {
    issues.push(
      issue(
        "INVALID_FORECAST_PERIOD",
        "input.asOf",
        "asOf must be later than period.startDate and earlier than period.endDate",
      ),
    );
  }

  if (compareDecimalStrings(input.period.allocation, "0") <= 0) {
    issues.push(
      issue(
        "NON_POSITIVE_ALLOCATION",
        "input.period.allocation",
        "period.allocation must be greater than zero",
      ),
    );
  }
  if (compareDecimalStrings(input.period.lowBalanceThreshold, "0") < 0) {
    issues.push(
      issue(
        "NEGATIVE_LOW_BALANCE_THRESHOLD",
        "input.period.lowBalanceThreshold",
        "period.lowBalanceThreshold must be non-negative",
      ),
    );
  }

  input.dailyUsage.forEach((usage, index) => {
    if (compareDecimalStrings(usage.creditsUsed, "0") < 0) {
      issues.push(
        issue(
          "NEGATIVE_DAILY_USAGE",
          `input.dailyUsage[${index}].creditsUsed`,
          "daily creditsUsed must be non-negative",
        ),
      );
    }
  });

  const dailyDates = input.dailyUsage.map(({ date }) => date);
  const seenDailyDates = new Set<string>();
  const duplicateDailyIndex = dailyDates.findIndex((date) => {
    if (seenDailyDates.has(date)) return true;
    seenDailyDates.add(date);
    return false;
  });
  const unorderedDailyIndex = dailyDates.findIndex(
    (date, index) => index > 0 && date < (dailyDates[index - 1] ?? ""),
  );

  if (duplicateDailyIndex >= 0) {
    issues.push(
      issue(
        "DUPLICATE_DAILY_USAGE_DATE",
        `input.dailyUsage[${duplicateDailyIndex}].date`,
        `dailyUsage contains duplicate date ${dailyDates[duplicateDailyIndex]}`,
      ),
    );
  }
  if (unorderedDailyIndex >= 0) {
    issues.push(
      issue(
        "UNORDERED_DAILY_HISTORY",
        "input.dailyUsage",
        "dailyUsage must be ordered by date",
      ),
    );
  }

  if (validPeriod) {
    const expectedDates = datesInRange(input.period.startDate, input.asOf);
    const suppliedDates = new Set(dailyDates);
    const expectedDateSet = new Set(expectedDates);
    const missingDates = expectedDates.filter((date) => !suppliedDates.has(date));
    const extraDates = dailyDates.filter((date) => !expectedDateSet.has(date));

    if (missingDates.length > 0) {
      issues.push(
        issue(
          "INCOMPLETE_DAILY_HISTORY",
          "input.dailyUsage",
          `dailyUsage must contain exactly one bucket for every date in [period.startDate, asOf); missing ${missingDates.join(", ")}`,
        ),
      );
    }
    if (extraDates.length > 0) {
      issues.push(
        issue(
          "EXTRA_DAILY_HISTORY",
          "input.dailyUsage",
          `dailyUsage contains dates outside [period.startDate, asOf): ${extraDates.join(", ")}`,
        ),
      );
    }
  }

  if (input.lookbackDays <= 0 || input.lookbackDays > input.dailyUsage.length) {
    issues.push(
      issue(
        "INVALID_LOOKBACK_DAYS",
        "input.lookbackDays",
        "lookbackDays must be greater than zero and no greater than observed-day count",
      ),
    );
  }

  issues.push(...scenarioAssumptionIssues(input.scenarios));

  let previousScheduleDate: string | undefined;
  input.balance.schedule.forEach((entry, index) => {
    if (validPeriod && (entry.date < input.asOf || entry.date >= input.period.endDate)) {
      issues.push(
        issue(
          "SCHEDULE_DATE_OUT_OF_RANGE",
          `input.balance.schedule[${index}].date`,
          "scheduled balance date must be inside [asOf, period.endDate)",
        ),
      );
    }
    if (previousScheduleDate !== undefined && entry.date < previousScheduleDate) {
      issues.push(
        issue(
          "UNORDERED_BALANCE_SCHEDULE",
          "input.balance.schedule",
          "balance.schedule must be ordered by date",
        ),
      );
    }
    previousScheduleDate = entry.date;
  });

  issues.push(...extensionNamespaceIssues(input.extensions));

  return issues;
};

export const validatePlanInputSemantics = (
  input: PlanInput,
): readonly ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  if (input.schemaVersion !== "1.0") {
    issues.push(
      issue(
        "UNSUPPORTED_SCHEMA_VERSION",
        "input.schemaVersion",
        'schemaVersion must equal "1.0"',
      ),
    );
  }
  if (input.methodologyVersion !== "1.0") {
    issues.push(
      issue(
        "UNSUPPORTED_METHODOLOGY_VERSION",
        "input.methodologyVersion",
        'methodologyVersion must equal "1.0"',
      ),
    );
  }

  if (input.period.endDate <= input.period.startDate) {
    issues.push(
      issue(
        "INVALID_PLAN_PERIOD",
        "input.period.endDate",
        "period.endDate must be later than period.startDate",
      ),
    );
  }

  if (input.metricEstimates.length === 0) {
    issues.push(
      issue(
        "EMPTY_METRIC_ESTIMATES",
        "input.metricEstimates",
        "metricEstimates must contain at least one metric estimate",
      ),
    );
  }

  const seenMetricKeys = new Set<string>();
  input.metricEstimates.forEach((metric, index) => {
    if (seenMetricKeys.has(metric.key)) {
      issues.push(
        issue(
          "DUPLICATE_METRIC_KEY",
          `input.metricEstimates[${index}].key`,
          `metricEstimates contains duplicate key ${metric.key}`,
        ),
      );
    }
    seenMetricKeys.add(metric.key);
    if (compareDecimalStrings(metric.estimatedUnits, "0") < 0) {
      issues.push(
        issue(
          "NEGATIVE_ESTIMATED_UNITS",
          `input.metricEstimates[${index}].estimatedUnits`,
          "estimatedUnits must be non-negative",
        ),
      );
    }
    if (compareDecimalStrings(metric.creditsPerUnit, "0") < 0) {
      issues.push(
        issue(
          "NEGATIVE_CREDITS_PER_UNIT",
          `input.metricEstimates[${index}].creditsPerUnit`,
          "creditsPerUnit must be non-negative",
        ),
      );
    }
  });

  if (
    input.allocation !== undefined &&
    compareDecimalStrings(input.allocation, "0") <= 0
  ) {
    issues.push(
      issue(
        "NON_POSITIVE_ALLOCATION",
        "input.allocation",
        "allocation must be greater than zero when supplied",
      ),
    );
  }

  issues.push(...scenarioAssumptionIssues(input.scenarios));
  issues.push(...extensionNamespaceIssues(input.extensions));

  return issues;
};

const resultIssue = (code: string, path: string, message: string): ValidationIssue => ({
  code,
  path,
  message,
});

const DECIMAL_SCALE = 1_000_000_000_000n;

const scaledDecimal = (value: string): bigint => {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer = "0", fraction = ""] = unsigned.split(".");
  const scaled =
    BigInt(integer) * DECIMAL_SCALE +
    BigInt(fraction.padEnd(12, "0"));
  return negative ? -scaled : scaled;
};

export const validateForecastResultSemantics = (
  result: ForecastResult,
): readonly ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const add = (code: string, path: string, message: string) => {
    issues.push(resultIssue(code, path, message));
  };
  const requireNonNegative = (value: string, path: string) => {
    if (compareDecimalStrings(value, "0") < 0) {
      add("NEGATIVE_RESULT_VALUE", path, `${path} must be non-negative`);
    }
  };

  if (result.schemaVersion !== "1.0") {
    add(
      "UNSUPPORTED_SCHEMA_VERSION",
      "result.schemaVersion",
      'schemaVersion must equal "1.0"',
    );
  }
  if (result.methodologyVersion !== "1.0") {
    add(
      "UNSUPPORTED_METHODOLOGY_VERSION",
      "result.methodologyVersion",
      'methodologyVersion must equal "1.0"',
    );
  }

  requireNonNegative(result.creditsUsedToDate, "result.creditsUsedToDate");
  requireNonNegative(result.baselineDailyBurn, "result.baselineDailyBurn");

  let observedTotal = 0n;
  if (result.observedPoints.length === 0) {
    add(
      "MISSING_OBSERVED_POINTS",
      "result.observedPoints",
      "observedPoints must contain at least one point",
    );
  }
  result.observedPoints.forEach((point, index) => {
    requireNonNegative(point.creditsUsed, `result.observedPoints[${index}].creditsUsed`);
    requireNonNegative(
      point.cumulativeCreditsUsed,
      `result.observedPoints[${index}].cumulativeCreditsUsed`,
    );
    observedTotal += scaledDecimal(point.creditsUsed);
    if (scaledDecimal(point.cumulativeCreditsUsed) !== observedTotal) {
      add(
        "OBSERVED_CUMULATIVE_MISMATCH",
        `result.observedPoints[${index}].cumulativeCreditsUsed`,
        "cumulativeCreditsUsed must equal the running total of observed creditsUsed",
      );
    }
    const previous = result.observedPoints[index - 1];
    if (previous !== undefined && point.date !== nextDate(previous.date)) {
      add(
        "INVALID_OBSERVED_POINT_DATES",
        `result.observedPoints[${index}].date`,
        "observed point dates must be consecutive and ordered",
      );
    }
    if (point.date >= result.asOf) {
      add(
        "OBSERVED_POINT_OUT_OF_RANGE",
        `result.observedPoints[${index}].date`,
        "observed point dates must be earlier than asOf",
      );
    }
  });
  const lastObservedPoint = result.observedPoints.at(-1);
  if (lastObservedPoint !== undefined && nextDate(lastObservedPoint.date) !== result.asOf) {
    add(
      "INCOMPLETE_OBSERVED_POINTS",
      "result.observedPoints",
      "the final observed point must be the day before asOf",
    );
  }
  if (scaledDecimal(result.creditsUsedToDate) !== observedTotal) {
    add(
      "CREDITS_USED_TO_DATE_MISMATCH",
      "result.creditsUsedToDate",
      "creditsUsedToDate must equal the sum of observed creditsUsed",
    );
  }

  const expectedScenarioKeys = ["low", "base", "high"] as const;
  if (!result.scenarios.every((scenario, index) => scenario.key === expectedScenarioKeys[index])) {
    add(
      "INVALID_SCENARIO_ORDER",
      "result.scenarios",
      "scenarios must contain exactly low, base, and high in that order",
    );
  }

  result.scenarios.forEach((scenario, scenarioIndex) => {
    const scenarioPath = `result.scenarios[${scenarioIndex}]`;
    requireNonNegative(scenario.dailyBurn, `${scenarioPath}.dailyBurn`);
    requireNonNegative(scenario.projectedCreditsUsed, `${scenarioPath}.projectedCreditsUsed`);
    requireNonNegative(
      scenario.projectedPeriodConsumption,
      `${scenarioPath}.projectedPeriodConsumption`,
    );
    requireNonNegative(scenario.utilization, `${scenarioPath}.utilization`);
    requireNonNegative(scenario.shortfall, `${scenarioPath}.shortfall`);

    const dailyBurn = scaledDecimal(scenario.dailyBurn);
    const projectedCreditsUsed = scaledDecimal(scenario.projectedCreditsUsed);
    if (projectedCreditsUsed !== dailyBurn * BigInt(result.daysRemaining)) {
      add(
        "PROJECTED_CREDITS_USED_MISMATCH",
        `${scenarioPath}.projectedCreditsUsed`,
        "projectedCreditsUsed must equal dailyBurn multiplied by daysRemaining",
      );
    }
    if (
      scaledDecimal(scenario.projectedPeriodConsumption) !==
      scaledDecimal(result.creditsUsedToDate) + projectedCreditsUsed
    ) {
      add(
        "PROJECTED_PERIOD_CONSUMPTION_MISMATCH",
        `${scenarioPath}.projectedPeriodConsumption`,
        "projectedPeriodConsumption must equal creditsUsedToDate plus projectedCreditsUsed",
      );
    }

    if (scenario.points.length !== result.daysRemaining) {
      add(
        "INVALID_PROJECTED_POINT_COUNT",
        `${scenarioPath}.points`,
        "projected point count must equal daysRemaining",
      );
    }
    scenario.points.forEach((point, pointIndex) => {
      requireNonNegative(point.creditsUsed, `${scenarioPath}.points[${pointIndex}].creditsUsed`);
      if (scaledDecimal(point.creditsUsed) !== dailyBurn) {
        add(
          "PROJECTED_POINT_USAGE_MISMATCH",
          `${scenarioPath}.points[${pointIndex}].creditsUsed`,
          "each projected point creditsUsed must equal scenario dailyBurn",
        );
      }
      const previousPoint = scenario.points[pointIndex - 1];
      if (
        previousPoint !== undefined &&
        scaledDecimal(point.startBalance) !== scaledDecimal(previousPoint.endingBalance)
      ) {
        add(
          "PROJECTED_BALANCE_CONTINUITY_MISMATCH",
          `${scenarioPath}.points[${pointIndex}].startBalance`,
          "each projected startBalance must equal the previous endingBalance",
        );
      }
      if (
        scaledDecimal(point.endingBalance) !==
        scaledDecimal(point.startBalance) +
          scaledDecimal(point.balanceDelta) -
          scaledDecimal(point.creditsUsed)
      ) {
        add(
          "PROJECTED_ENDING_BALANCE_MISMATCH",
          `${scenarioPath}.points[${pointIndex}].endingBalance`,
          "each projected endingBalance must equal startBalance plus balanceDelta minus creditsUsed",
        );
      }
      const expectedDate = pointIndex === 0
        ? result.asOf
        : nextDate(scenario.points[pointIndex - 1]?.date ?? result.asOf);
      if (point.date !== expectedDate) {
        add(
          "INVALID_PROJECTED_POINT_DATES",
          `${scenarioPath}.points[${pointIndex}].date`,
          "projected point dates must start at asOf and remain consecutive",
        );
      }
    });

    const finalPoint = scenario.points.at(-1);
    if (finalPoint !== undefined && finalPoint.endingBalance !== scenario.endingBalance) {
      add(
        "ENDING_BALANCE_MISMATCH",
        `${scenarioPath}.endingBalance`,
        "endingBalance must equal the final projected point endingBalance",
      );
    }

    const firstDepletedPoint = scenario.points.find(
      ({ endingBalance }) => compareDecimalStrings(endingBalance, "0") <= 0,
    );
    const expectedDepletionDate = firstDepletedPoint?.date ?? null;
    if (scenario.depletionDate !== expectedDepletionDate) {
      add(
        "DEPLETION_DATE_MISMATCH",
        `${scenarioPath}.depletionDate`,
        "depletionDate must equal the first projected date with endingBalance <= 0",
      );
    }
    if (
      (expectedDepletionDate === null && scenario.status === "DEPLETION_PROJECTED") ||
      (expectedDepletionDate !== null && scenario.status !== "DEPLETION_PROJECTED")
    ) {
      add(
        "STATUS_DEPLETION_MISMATCH",
        `${scenarioPath}.status`,
        "DEPLETION_PROJECTED status must match the projected depletion state",
      );
    }

    const expectedShortfall = scenario.endingBalance.startsWith("-")
      ? scenario.endingBalance.slice(1)
      : "0";
    if (scenario.shortfall !== expectedShortfall) {
      add(
        "SHORTFALL_MISMATCH",
        `${scenarioPath}.shortfall`,
        "shortfall must equal max(0, -endingBalance)",
      );
    }
  });

  const [lowScenario, baseScenario, highScenario] = result.scenarios;
  if (
    baseScenario !== undefined &&
    scaledDecimal(baseScenario.dailyBurn) !== scaledDecimal(result.baselineDailyBurn)
  ) {
    add(
      "BASELINE_DAILY_BURN_MISMATCH",
      "result.baselineDailyBurn",
      "baselineDailyBurn must equal base scenario dailyBurn",
    );
  }
  if (
    lowScenario !== undefined &&
    baseScenario !== undefined &&
    highScenario !== undefined
  ) {
    if (
      scaledDecimal(lowScenario.dailyBurn) > scaledDecimal(baseScenario.dailyBurn) ||
      scaledDecimal(baseScenario.dailyBurn) > scaledDecimal(highScenario.dailyBurn) ||
      scaledDecimal(lowScenario.endingBalance) < scaledDecimal(baseScenario.endingBalance) ||
      scaledDecimal(baseScenario.endingBalance) < scaledDecimal(highScenario.endingBalance)
    ) {
      add(
        "INVALID_SCENARIO_RESULT_ORDER",
        "result.scenarios",
        "scenario results must preserve low, base, and high burn and ending-balance order",
      );
    }

    const lowPoints = lowScenario.points;
    [baseScenario, highScenario].forEach((scenario, scenarioOffset) => {
      scenario.points.forEach((point, pointIndex) => {
        const lowPoint = lowPoints[pointIndex];
        const initialBalanceMismatch =
          pointIndex === 0 && point.startBalance !== lowPoints[0]?.startBalance;
        const scheduledDeltaMismatch =
          lowPoint !== undefined && point.balanceDelta !== lowPoint.balanceDelta;
        if (
          lowPoint !== undefined &&
          (initialBalanceMismatch || scheduledDeltaMismatch)
        ) {
          add(
            "SCENARIO_BALANCE_INPUT_MISMATCH",
            `result.scenarios[${scenarioOffset + 1}].points[${pointIndex}]`,
            "all scenarios must use the same initial balance and scheduled balance deltas",
          );
        }
      });
    });
  }

  const sourcePaths = new Set<string>();
  result.calculationTrace.sourceInputs.forEach(({ path }, index) => {
    if (sourcePaths.has(path)) {
      add(
        "DUPLICATE_TRACE_SOURCE",
        `result.calculationTrace.sourceInputs[${index}].path`,
        "calculation trace source paths must be unique",
      );
    }
    sourcePaths.add(path);
  });
  const stepKeys = new Set<string>();
  result.calculationTrace.steps.forEach(({ key }, index) => {
    if (stepKeys.has(key)) {
      add(
        "DUPLICATE_TRACE_STEP",
        `result.calculationTrace.steps[${index}].key`,
        "calculation trace step keys must be unique",
      );
    }
    stepKeys.add(key);
  });

  const warningKeys = new Set<string>();
  result.warnings.forEach((warning, warningIndex) => {
    const warningPath = `result.warnings[${warningIndex}]`;
    const warningKey = `${warning.code}:${warning.scenarioKey}`;
    if (warningKeys.has(warningKey)) {
      add("DUPLICATE_WARNING", warningPath, "warnings must not contain duplicates");
    }
    warningKeys.add(warningKey);

    const scenario = result.scenarios.find(({ key }) => key === warning.scenarioKey);
    if (scenario === undefined) return;
    if (warning.code === "DEPLETION_PROJECTED") {
      if (
        scenario.depletionDate !== warning.depletionDate ||
        scenario.shortfall !== warning.shortfall
      ) {
        add(
          "DEPLETION_WARNING_MISMATCH",
          warningPath,
          "depletion warning must match its scenario depletionDate and shortfall",
        );
      }
      return;
    }

    requireNonNegative(warning.threshold, `${warningPath}.threshold`);
    if (
      warning.endingBalance !== scenario.endingBalance ||
      compareDecimalStrings(warning.endingBalance, "0") <= 0 ||
      compareDecimalStrings(warning.endingBalance, warning.threshold) > 0 ||
      scenario.status === "ON_TRACK"
    ) {
      add(
        "LOW_BALANCE_WARNING_MISMATCH",
        warningPath,
        "low-balance warning must match a positive ending balance at or below its threshold",
      );
    }
  });

  result.scenarios.forEach((scenario, scenarioIndex) => {
    if (
      scenario.depletionDate !== null &&
      !result.warnings.some(
        (warning) =>
          warning.code === "DEPLETION_PROJECTED" && warning.scenarioKey === scenario.key,
      )
    ) {
      add(
        "MISSING_DEPLETION_WARNING",
        `result.scenarios[${scenarioIndex}]`,
        "every depleted scenario must have a depletion warning",
      );
    }
    if (
      scenario.status === "LOW_BALANCE_PROJECTED" &&
      !result.warnings.some(
        (warning) =>
          warning.code === "LOW_BALANCE_PROJECTED" && warning.scenarioKey === scenario.key,
      )
    ) {
      add(
        "MISSING_LOW_BALANCE_WARNING",
        `result.scenarios[${scenarioIndex}]`,
        "every low-balance scenario must have a low-balance warning",
      );
    }
  });

  return issues;
};

const roundHalfUpDiv = (numerator: bigint, denominator: bigint): bigint =>
  (2n * numerator + denominator) / (2n * denominator);

const scaledProduct = (left: string, right: string): bigint =>
  roundHalfUpDiv(scaledDecimal(left) * scaledDecimal(right), DECIMAL_SCALE);

export const validatePlanResultSemantics = (
  result: PlanResult,
): readonly ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const add = (code: string, path: string, message: string) => {
    issues.push(resultIssue(code, path, message));
  };
  const nonNegative = (value: string): boolean =>
    compareDecimalStrings(value, "0") >= 0;
  const requireNonNegative = (value: string, path: string) => {
    if (!nonNegative(value)) {
      add("NEGATIVE_RESULT_VALUE", path, `${path} must be non-negative`);
    }
  };

  if (result.schemaVersion !== "1.0") {
    add(
      "UNSUPPORTED_SCHEMA_VERSION",
      "result.schemaVersion",
      'schemaVersion must equal "1.0"',
    );
  }
  if (result.methodologyVersion !== "1.0") {
    add(
      "UNSUPPORTED_METHODOLOGY_VERSION",
      "result.methodologyVersion",
      'methodologyVersion must equal "1.0"',
    );
  }

  requireNonNegative(result.baselinePlannedCredits, "result.baselinePlannedCredits");
  requireNonNegative(
    result.baselineAverageDailyBurn,
    "result.baselineAverageDailyBurn",
  );

  if (result.metrics.length === 0) {
    add(
      "MISSING_PLAN_METRICS",
      "result.metrics",
      "metrics must contain at least one planned metric",
    );
  }

  const seenMetricKeys = new Set<string>();
  let baselineTotal = 0n;
  result.metrics.forEach((metric, index) => {
    const metricPath = `result.metrics[${index}]`;
    if (seenMetricKeys.has(metric.key)) {
      add(
        "DUPLICATE_METRIC_KEY",
        `${metricPath}.key`,
        `metrics contains duplicate key ${metric.key}`,
      );
    }
    seenMetricKeys.add(metric.key);
    requireNonNegative(metric.estimatedUnits, `${metricPath}.estimatedUnits`);
    requireNonNegative(metric.creditsPerUnit, `${metricPath}.creditsPerUnit`);
    requireNonNegative(metric.plannedCredits, `${metricPath}.plannedCredits`);
    if (
      nonNegative(metric.estimatedUnits) &&
      nonNegative(metric.creditsPerUnit) &&
      scaledDecimal(metric.plannedCredits) !==
        scaledProduct(metric.estimatedUnits, metric.creditsPerUnit)
    ) {
      add(
        "METRIC_PLANNED_CREDITS_MISMATCH",
        `${metricPath}.plannedCredits`,
        "plannedCredits must equal estimatedUnits multiplied by creditsPerUnit",
      );
    }
    baselineTotal += scaledDecimal(metric.plannedCredits);
  });
  if (scaledDecimal(result.baselinePlannedCredits) !== baselineTotal) {
    add(
      "BASELINE_PLANNED_CREDITS_MISMATCH",
      "result.baselinePlannedCredits",
      "baselinePlannedCredits must equal the sum of metric plannedCredits",
    );
  }
  if (
    scaledDecimal(result.baselineAverageDailyBurn) !==
    roundHalfUpDiv(scaledDecimal(result.baselinePlannedCredits), BigInt(result.daysInPeriod))
  ) {
    add(
      "BASELINE_AVERAGE_DAILY_BURN_MISMATCH",
      "result.baselineAverageDailyBurn",
      "baselineAverageDailyBurn must equal baselinePlannedCredits divided by daysInPeriod",
    );
  }

  const expectedScenarioKeys = ["low", "base", "high"] as const;
  if (
    result.scenarios.length !== expectedScenarioKeys.length ||
    !result.scenarios.every((scenario, index) => scenario.key === expectedScenarioKeys[index])
  ) {
    add(
      "INVALID_SCENARIO_ORDER",
      "result.scenarios",
      "scenarios must contain exactly low, base, and high in that order",
    );
  }

  const metricKeys = result.metrics.map(({ key }) => key);
  result.scenarios.forEach((scenario, scenarioIndex) => {
    const scenarioPath = `result.scenarios[${scenarioIndex}]`;
    requireNonNegative(scenario.burnMultiplier, `${scenarioPath}.burnMultiplier`);
    requireNonNegative(scenario.plannedCredits, `${scenarioPath}.plannedCredits`);
    requireNonNegative(scenario.averageDailyBurn, `${scenarioPath}.averageDailyBurn`);

    const breakdownKeys = scenario.metricBreakdown.map(({ key }) => key);
    if (
      breakdownKeys.length !== metricKeys.length ||
      !breakdownKeys.every((key, index) => key === metricKeys[index])
    ) {
      add(
        "METRIC_BREAKDOWN_MISMATCH",
        `${scenarioPath}.metricBreakdown`,
        "metricBreakdown keys must match result.metrics keys in order",
      );
    }

    let breakdownTotal = 0n;
    scenario.metricBreakdown.forEach((entry, entryIndex) => {
      const entryPath = `${scenarioPath}.metricBreakdown[${entryIndex}]`;
      requireNonNegative(entry.plannedCredits, `${entryPath}.plannedCredits`);
      const metric = result.metrics[entryIndex];
      if (
        metric !== undefined &&
        metric.key === entry.key &&
        nonNegative(metric.plannedCredits) &&
        nonNegative(scenario.burnMultiplier) &&
        scaledDecimal(entry.plannedCredits) !==
          scaledProduct(metric.plannedCredits, scenario.burnMultiplier)
      ) {
        add(
          "BREAKDOWN_PLANNED_CREDITS_MISMATCH",
          `${entryPath}.plannedCredits`,
          "each breakdown plannedCredits must equal the metric plannedCredits multiplied by burnMultiplier",
        );
      }
      breakdownTotal += scaledDecimal(entry.plannedCredits);
    });
    if (scaledDecimal(scenario.plannedCredits) !== breakdownTotal) {
      add(
        "PLANNED_CREDITS_MISMATCH",
        `${scenarioPath}.plannedCredits`,
        "scenario plannedCredits must equal the sum of its metricBreakdown plannedCredits",
      );
    }
    if (
      scaledDecimal(scenario.averageDailyBurn) !==
      roundHalfUpDiv(scaledDecimal(scenario.plannedCredits), BigInt(result.daysInPeriod))
    ) {
      add(
        "AVERAGE_DAILY_BURN_MISMATCH",
        `${scenarioPath}.averageDailyBurn`,
        "averageDailyBurn must equal scenario plannedCredits divided by daysInPeriod",
      );
    }

    const comparison = scenario.comparison;
    if (comparison !== null) {
      const comparisonPath = `${scenarioPath}.comparison`;
      if (compareDecimalStrings(comparison.allocation, "0") <= 0) {
        add(
          "NON_POSITIVE_ALLOCATION",
          `${comparisonPath}.allocation`,
          "comparison allocation must be greater than zero",
        );
      } else if (nonNegative(scenario.plannedCredits)) {
        const scaledPlanned = scaledDecimal(scenario.plannedCredits);
        const scaledAllocation = scaledDecimal(comparison.allocation);
        if (
          scaledDecimal(comparison.utilization) !==
          roundHalfUpDiv(scaledPlanned * DECIMAL_SCALE, scaledAllocation)
        ) {
          add(
            "UTILIZATION_MISMATCH",
            `${comparisonPath}.utilization`,
            "utilization must equal scenario plannedCredits divided by allocation",
          );
        }
        const difference = scaledPlanned - scaledAllocation;
        const expectedShortfall = difference > 0n ? difference : 0n;
        const expectedSurplus = difference < 0n ? -difference : 0n;
        if (scaledDecimal(comparison.shortfall) !== expectedShortfall) {
          add(
            "SHORTFALL_MISMATCH",
            `${comparisonPath}.shortfall`,
            "shortfall must equal max(0, plannedCredits - allocation)",
          );
        }
        if (scaledDecimal(comparison.surplus) !== expectedSurplus) {
          add(
            "SURPLUS_MISMATCH",
            `${comparisonPath}.surplus`,
            "surplus must equal max(0, allocation - plannedCredits)",
          );
        }
        const expectedStatus =
          difference > 0n ? "OVER_ALLOCATION" : "WITHIN_ALLOCATION";
        if (comparison.status !== expectedStatus) {
          add(
            "STATUS_MISMATCH",
            `${comparisonPath}.status`,
            "status must be OVER_ALLOCATION exactly when plannedCredits exceed allocation",
          );
        }
      }
    }
  });

  const comparisons = result.scenarios.map(({ comparison }) => comparison);
  const withComparison = comparisons.filter((comparison) => comparison !== null);
  if (withComparison.length !== 0 && withComparison.length !== comparisons.length) {
    add(
      "ALLOCATION_COMPARISON_MISMATCH",
      "result.scenarios",
      "either every scenario or no scenario may carry an allocation comparison",
    );
  }
  if (
    withComparison.length > 1 &&
    !withComparison.every(
      (comparison) => comparison.allocation === withComparison[0]?.allocation,
    )
  ) {
    add(
      "ALLOCATION_COMPARISON_MISMATCH",
      "result.scenarios",
      "every scenario comparison must use the same allocation",
    );
  }

  const [lowPlan, basePlan, highPlan] = result.scenarios;
  if (
    lowPlan !== undefined &&
    basePlan !== undefined &&
    highPlan !== undefined
  ) {
    if (
      scaledDecimal(basePlan.plannedCredits) !==
      scaledDecimal(result.baselinePlannedCredits)
    ) {
      add(
        "BASE_PLAN_MISMATCH",
        "result.scenarios[1].plannedCredits",
        "base scenario plannedCredits must equal baselinePlannedCredits",
      );
    }
    if (
      scaledDecimal(lowPlan.plannedCredits) > scaledDecimal(basePlan.plannedCredits) ||
      scaledDecimal(basePlan.plannedCredits) > scaledDecimal(highPlan.plannedCredits)
    ) {
      add(
        "INVALID_SCENARIO_RESULT_ORDER",
        "result.scenarios",
        "scenario results must preserve low, base, and high planned-credit order",
      );
    }
  }

  const warningKeys = new Set<string>();
  result.warnings.forEach((warning, warningIndex) => {
    const warningPath = `result.warnings[${warningIndex}]`;
    const warningKey = `${warning.code}:${warning.scenarioKey}`;
    if (warningKeys.has(warningKey)) {
      add("DUPLICATE_WARNING", warningPath, "warnings must not contain duplicates");
    }
    warningKeys.add(warningKey);

    const scenario = result.scenarios.find(({ key }) => key === warning.scenarioKey);
    const comparison = scenario?.comparison ?? null;
    if (
      scenario === undefined ||
      comparison === null ||
      comparison.status !== "OVER_ALLOCATION" ||
      warning.plannedCredits !== scenario.plannedCredits ||
      warning.allocation !== comparison.allocation ||
      warning.shortfall !== comparison.shortfall
    ) {
      add(
        "OVER_ALLOCATION_WARNING_MISMATCH",
        warningPath,
        "over-allocation warning must match an OVER_ALLOCATION scenario comparison",
      );
    }
  });
  result.scenarios.forEach((scenario, scenarioIndex) => {
    if (
      scenario.comparison?.status === "OVER_ALLOCATION" &&
      !result.warnings.some(
        (warning) =>
          warning.code === "OVER_ALLOCATION" && warning.scenarioKey === scenario.key,
      )
    ) {
      add(
        "MISSING_OVER_ALLOCATION_WARNING",
        `result.scenarios[${scenarioIndex}]`,
        "every over-allocation scenario must have an over-allocation warning",
      );
    }
  });

  const sourcePaths = new Set<string>();
  result.calculationTrace.sourceInputs.forEach(({ path }, index) => {
    if (sourcePaths.has(path)) {
      add(
        "DUPLICATE_TRACE_SOURCE",
        `result.calculationTrace.sourceInputs[${index}].path`,
        "calculation trace source paths must be unique",
      );
    }
    sourcePaths.add(path);
  });
  const stepKeys = new Set<string>();
  result.calculationTrace.steps.forEach(({ key }, index) => {
    if (stepKeys.has(key)) {
      add(
        "DUPLICATE_TRACE_STEP",
        `result.calculationTrace.steps[${index}].key`,
        "calculation trace step keys must be unique",
      );
    }
    stepKeys.add(key);
  });

  return issues;
};
