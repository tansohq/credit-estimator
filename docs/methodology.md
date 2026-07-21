# Credit Usage Forecasting Methodology

## Purpose

This document defines the deterministic calculations for a customer-facing
credit usage and burndown forecast. The engine combines complete daily usage
history, the current credit balance, explicit future balance changes, and
low/base/high burn assumptions.

The result gives adopting products the observed and projected series needed to
render usage charts without duplicating forecast formulas.

The engine does not set credit prices or weights. It does not own balances,
transactions, grants, deductions, entitlements, subscriptions, or payments.

## Deterministic inputs

Every calculation input includes:

- `schemaVersion`;
- `methodologyVersion`;
- `asOf`;
- `period.startDate` and `period.endDate`;
- `period.allocation`;
- `period.lowBalanceThreshold`;
- `lookbackDays`;
- `dailyUsage`;
- `balance.current`;
- `balance.schedule`; and
- exactly three scenarios: `low`, `base`, and `high`.

Every successful output echoes `schemaVersion`, `methodologyVersion`, and
`asOf`, and returns the calculated `daysRemaining`. `modelVersion` is not part
of this forecasting contract.

The calculation must not read the current clock, generate timestamps, call a
network service, read product credentials, or depend on provider-specific
identifiers. The caller supplies `asOf` explicitly.

All decimal credit amounts, balances, rates, multipliers, utilization values,
and decimal trace operands or results use canonical base-10 strings in JSON.
For example, use `"50"`, `"0.5"`, and `"-25.5"`. Use `"0"` for zero; omit
insignificant leading or trailing zeros; never use exponent notation. Integer
counts such as `lookbackDays` and `daysRemaining` remain JSON integers.
Implementations must parse decimal strings into a decimal-safe type and must
never perform these calculations with binary floating point.

## Precision and rounding

Calculation precision is deterministic:

- input decimal strings may contain at most 12 fractional digits;
- every named decimal result is rounded to at most 12 fractional digits using
  round-half-up;
- trailing fractional zeros are removed after rounding;
- negative zero is serialized as `"0"`; and
- each subsequent formula uses the rounded value of the preceding named
  result.

For example, `1 / 3` becomes `"0.333333333333"` and
`0.333333333333 * 1.5` becomes `"0.5"`. Addition and subtraction remain exact
until the named result is rounded. This rule applies to summary values, chart
points, warnings, and traces so they always reconcile.

## Date rules

All dates are ISO 8601 calendar dates in `YYYY-MM-DD` form. Timestamps and time
zones are invalid inputs.

The allocation period is the half-open interval:

    [period.startDate, period.endDate)

The observed interval is:

    [period.startDate, asOf)

The forecast interval is:

    [asOf, period.endDate)

`asOf` must be later than `period.startDate` and earlier than
`period.endDate`. `daysRemaining` is the number of calendar dates in the
forecast interval. No generated calculation timestamp belongs in the output.

## Daily usage history

`dailyUsage` must contain exactly one bucket for every calendar date in the
observed interval, ordered by date, with no missing dates and no duplicates.
Each bucket contains:

- `date`; and
- non-negative `creditsUsed`.

Missing dates are not silently treated as zero. A zero-usage day must be
supplied explicitly with `creditsUsed: "0"`. Extra buckets outside the observed
interval are invalid.

`creditsUsedToDate` is:

    creditsUsedToDate = sum(dailyUsage[*].creditsUsed)

The output includes an observed chart point for every input bucket:

    observedPoints[n].date = dailyUsage[n].date
    observedPoints[n].creditsUsed = dailyUsage[n].creditsUsed
    observedPoints[n].cumulativeCreditsUsed
      = sum(dailyUsage[0..n].creditsUsed)

## Baseline daily burn

`lookbackDays` is an explicit positive integer no greater than the number of
observed daily buckets. The lookback window ends on `asOf` and contains the
last `lookbackDays` buckets.

Baseline daily burn is:

    baselineDailyBurn
      = sum(credits used in lookback window) / lookbackDays

The engine does not infer a lookback length and does not substitute a default.

## Scenarios

The input must contain scenarios in this order:

    low, base, high

Each scenario has an explicit non-negative `burnMultiplier`. The base
multiplier must equal `1`. Multipliers must be ordered:

    low.burnMultiplier < base.burnMultiplier < high.burnMultiplier

Scenario daily burn is:

    dailyBurn = baselineDailyBurn * burnMultiplier

For each scenario:

    projectedCreditsUsed = dailyBurn * daysRemaining

    projectedPeriodConsumption = creditsUsedToDate + projectedCreditsUsed

    utilization = projectedPeriodConsumption / period.allocation

`period.allocation` must be greater than zero. Utilization may exceed `1`.

## Future balance schedule

`balance.current` is the credit balance at the start of `asOf`, before any
scheduled balance change or forecast usage on that date. It may be zero or
negative.

`balance.schedule` contains explicit future balance changes. Each item has:

- `date` in the forecast interval; and
- signed `creditDelta`.

Positive values may represent grants or top-ups. Negative values may represent
expirations or adjustments. Optional reason or extension data is descriptive
and must not change arithmetic. Schedule rows are ordered by date. Multiple
changes on one date are allowed and summed in their supplied order.

For each forecast date, a scheduled delta is applied at the start of the date,
then daily burn is deducted:

    startBalance[date]
      = date == asOf
          ? balance.current
          : endingBalance[previous date]

    balanceDelta[date]
      = sum(schedule.creditDelta where schedule.date == date)

    creditsUsed[date] = dailyBurn

    endingBalance[date]
      = startBalance[date] + balanceDelta[date] - creditsUsed[date]

Each scenario returns one projected chart point per forecast date with:

- `date`;
- `startBalance`;
- `balanceDelta`;
- `creditsUsed`; and
- `endingBalance`.

The scenario `endingBalance` is the final projected point's ending balance. It
may be negative.

## Depletion and status

`depletionDate` is the first forecast date whose projected point has:

    endingBalance <= 0

It is `null` when no forecast point meets that condition. A later grant does
not erase an earlier depletion date.

Credit shortfall is:

    shortfall = max(0, -endingBalance)

Status uses any projected depletion, then final projected ending balance and
the explicit threshold:

    if depletionDate != null:
      DEPLETION_PROJECTED
    else if endingBalance <= period.lowBalanceThreshold:
      LOW_BALANCE_PROJECTED
    else:
      ON_TRACK

`period.lowBalanceThreshold` must be non-negative. Threshold equality returns
`LOW_BALANCE_PROJECTED`. A later scheduled grant can restore a positive final
balance, but it does not erase an earlier depletion date, status, or warning.

## Warnings

Warnings are structured and deterministic. At minimum:

- a `DEPLETION_PROJECTED` warning identifies every scenario with a non-null
  `depletionDate` and includes `depletionDate` and final `shortfall`; and
- a `LOW_BALANCE_PROJECTED` warning identifies every scenario with a positive
  ending balance at or below the explicit threshold.

Warnings must not modify inputs, suppress scenarios, or invent corrective
actions.

## Calculation trace

Every successful result includes `calculationTrace.sourceInputs` and ordered
`calculationTrace.steps`. The trace preserves:

- source input paths and values;
- cumulative observed usage;
- baseline lookback selection, sum, and division;
- calendar `daysRemaining`;
- scenario daily burn;
- projected usage;
- projected period consumption;
- utilization;
- scheduled balance deltas;
- ending balance;
- depletion-date selection;
- shortfall; and
- status selection.

Trace steps are ordered. Each step includes a stable key, the formula or rule,
its operands, and its result. A consumer must be able to explain every chart
point and summary without rerunning hidden formulas.

## Validation failures

Invalid inputs produce a structured validation failure rather than a partial
forecast. The failure echoes `schemaVersion` and `methodologyVersion` and
contains stable issue codes and input paths.

Validation must reject at least:

- invalid or non-date-only date strings;
- an invalid period or `asOf` outside the allowed range;
- missing, duplicated, unordered, or extra daily buckets;
- negative observed usage;
- an invalid `lookbackDays`;
- a non-positive allocation;
- a negative low-balance threshold;
- missing, duplicated, unordered, or incorrectly multiplied scenarios;
- an unordered schedule or a scheduled date outside the forecast interval;
- non-decimal-safe or non-finite numeric values.

Forecast inputs are never silently defaulted.

## Worked example

Given:

- period `[2026-01-01, 2026-01-11)`;
- `asOf` `2026-01-06`;
- five observed days of 50 credits each;
- a three-day lookback;
- current balance 700 credits;
- allocation 1,000 credits;
- low-balance threshold 100 credits;
- no scheduled balance changes; and
- multipliers `0.5`, `1`, and `1.5`;

the baseline is 50 credits per day and five forecast days remain. Base
projected usage is 250 credits, projected period consumption is 500 credits,
utilization is 0.5, ending balance is 450 credits, and status is `ON_TRACK`.

## Deferred forecasting methods

Seasonality, day-of-week weighting, trend fitting, confidence intervals,
probabilistic depletion, anomaly correction, and automated recommendations are
outside this methodology version. They require explicit versioned formulas and
new golden scenarios before implementation.
