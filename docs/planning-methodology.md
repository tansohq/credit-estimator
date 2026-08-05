# Credit Planning Methodology

## Purpose

This document defines the deterministic calculations for a buyer-facing
credit plan estimate. The engine converts explicit per-metric usage
estimates and host-supplied credit weights into expected credit consumption
for a plan period, applies low/base/high scenario multipliers, and compares
each scenario against an optional candidate allocation.

The planning calculation answers the question a prospective buyer asks
before committing: "How many credits do I need for this period?" It
complements the burndown forecast, which answers the question an existing
customer asks after committing: "Will my credits last?"

The engine does not set credit prices or weights, recommend allocations or
plans, calculate money amounts, or predict usage from historical or
similar-customer data. Estimates, weights, multipliers, and the candidate
allocation are explicit host-supplied inputs.

## Deterministic inputs

Every plan calculation input includes:

- `schemaVersion`;
- `methodologyVersion`;
- `period.startDate` and `period.endDate`;
- `metricEstimates`, a non-empty list of per-metric estimates; and
- exactly three scenarios: `low`, `base`, and `high`.

It may include:

- `allocation`, a candidate credit allocation to compare against; and
- namespaced `extensions`.

Each metric estimate contains:

- `key`, a unique non-empty identifier;
- optional descriptive `label`, which never changes arithmetic;
- non-negative `estimatedUnits`, the units of this pricing metric the buyer
  expects to consume across the whole plan period; and
- non-negative `creditsPerUnit`, the host-supplied credit weight for one
  unit of this metric.

Every successful output echoes `schemaVersion` and `methodologyVersion` and
returns the calculated `daysInPeriod`. `modelVersion` is not part of this
planning contract.

The calculation must not read the current clock, generate timestamps, call a
network service, read product credentials, or depend on provider-specific
identifiers.

All decimal unit counts, credit weights, credit amounts, multipliers,
utilization values, and decimal trace operands or results use canonical
base-10 strings in JSON, exactly as in the forecasting methodology. Integer
counts such as `daysInPeriod` remain JSON integers. Implementations must
parse decimal strings into a decimal-safe type and must never perform these
calculations with binary floating point.

## Precision and rounding

The precision rules are identical to the forecasting methodology:

- input decimal strings may contain at most 12 fractional digits;
- every named decimal result is rounded to at most 12 fractional digits
  using round-half-up;
- trailing fractional zeros are removed after rounding;
- negative zero is serialized as `"0"`; and
- each subsequent formula uses the rounded value of the preceding named
  result.

## Date rules

All dates are ISO 8601 calendar dates in `YYYY-MM-DD` form. Timestamps and
time zones are invalid inputs.

The plan period is the half-open interval:

    [period.startDate, period.endDate)

`period.endDate` must be later than `period.startDate`. `daysInPeriod` is
the number of calendar dates in the plan period. A month, quarter, or
project horizon is expressed only through these explicit boundary dates.

## Planned credits per metric

For each metric estimate:

    plannedCredits = estimatedUnits * creditsPerUnit

The result list preserves the supplied metric order and echoes `key`,
`label`, `estimatedUnits`, and `creditsPerUnit` unchanged.

## Baseline plan

    baselinePlannedCredits = sum(metrics[*].plannedCredits)

    baselineAverageDailyBurn = baselinePlannedCredits / daysInPeriod

`baselineAverageDailyBurn` is descriptive. It lets hosts relate a plan to
the burndown forecaster's daily-burn vocabulary; the planning methodology
itself contains no daily projection points.

## Scenarios

The input must contain scenarios in this order:

    low, base, high

Each scenario has an explicit non-negative `burnMultiplier`. The base
multiplier must equal `1`. Multipliers must be ordered:

    low.burnMultiplier < base.burnMultiplier < high.burnMultiplier

For each scenario, every metric receives a scenario-scaled planned amount:

    metricBreakdown[i].plannedCredits
      = metrics[i].plannedCredits * burnMultiplier

The scenario total is the sum of the scaled per-metric amounts, not the
scaled baseline total:

    plannedCredits = sum(metricBreakdown[*].plannedCredits)

    averageDailyBurn = plannedCredits / daysInPeriod

Summing rounded per-metric amounts guarantees that the visible breakdown
always reconciles exactly with the scenario total. Because the base
multiplier is `1`, the base scenario `plannedCredits` always equals
`baselinePlannedCredits`.

## Allocation comparison

When `allocation` is supplied it must be greater than zero, and every
scenario receives a comparison:

    utilization = plannedCredits / allocation

    shortfall = max(0, plannedCredits - allocation)

    surplus = max(0, allocation - plannedCredits)

    status = plannedCredits > allocation
      ? OVER_ALLOCATION
      : WITHIN_ALLOCATION

Equality returns `WITHIN_ALLOCATION` with zero shortfall and zero surplus.
Utilization may exceed `1`.

When `allocation` is absent, every scenario `comparison` is `null`, no
status is classified, and no warnings are produced. The engine never
invents a default allocation.

## Warnings

Warnings are structured and deterministic. An `OVER_ALLOCATION` warning
identifies every scenario whose status is `OVER_ALLOCATION` and includes
that scenario's `plannedCredits`, the shared `allocation`, and `shortfall`.

Warnings must not modify inputs, suppress scenarios, or invent corrective
actions.

## Calculation trace

Every successful result includes `calculationTrace.sourceInputs` and
ordered `calculationTrace.steps`. The trace preserves:

- source input paths and values, including every metric estimate and
  scenario multiplier;
- per-metric planned credits;
- the baseline sum;
- calendar `daysInPeriod`;
- baseline average daily burn;
- per-scenario metric breakdowns, totals, and average daily burn; and
- per-scenario utilization, surplus, shortfall, and status selection when an
  allocation is supplied.

Trace steps are ordered. Each step includes a stable key, the formula or
rule, its operands, and its result. A consumer must be able to explain
every summary value without rerunning hidden formulas.

## Validation failures

Invalid inputs produce a structured validation failure rather than a
partial plan. The failure echoes `schemaVersion` and `methodologyVersion`
and contains stable issue codes and input paths.

Validation must reject at least:

- invalid or non-date-only date strings;
- a period whose `endDate` is not later than its `startDate`;
- an empty metric-estimate list;
- duplicate metric keys;
- negative `estimatedUnits` or `creditsPerUnit`;
- a supplied non-positive `allocation`;
- missing, duplicated, unordered, or incorrectly multiplied scenarios;
- non-decimal-safe or non-finite numeric values; and
- extension keys without a collision-resistant namespace.

Plan inputs are never silently defaulted.

## Worked example

Given:

- period `[2026-02-01, 2026-03-01)`, so `daysInPeriod` is 28;
- metric `api-calls` with 1,000 estimated units at 0.5 credits per unit;
- metric `reports` with 20 estimated units at 5 credits per unit;
- multipliers `0.8`, `1`, and `1.25`; and
- a candidate allocation of 700 credits;

planned credits are 500 for `api-calls` and 100 for `reports`, so
`baselinePlannedCredits` is 600. The base scenario plans 600 credits
(utilization `0.857142857143`, surplus 100, `WITHIN_ALLOCATION`), the low
scenario plans 480, and the high scenario plans 750 credits, which exceeds
the allocation by 50 and produces an `OVER_ALLOCATION` warning with a
shortfall of 50.

## Deferred planning methods

Currency or money cost totals, tiered or committed pricing, credit-weight
or allocation recommendations, cohort or similar-customer priors, and any
machine-learning prediction are outside this methodology version. They
require explicit versioned formulas — and, for priors, explicit
host-supplied inputs — before implementation.
