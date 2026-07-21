# Credit Forecast Agent Guide

## Mission

Build a product-neutral, customer-facing credit usage and burndown forecaster.
Companies embed it in their dashboards so customers can understand:

- usage so far;
- current burn rate;
- projected low, base, and high usage;
- expected balance at period end;
- likely depletion date;
- shortfall or low-balance risk; and
- the inputs and calculations behind every result.

This is not a pricing-design tool. It does not calculate provider cost,
customer value, credit weights, plan recommendations, or runtime credit
quotes.

Tanso is one optional adapter, not the architecture. The core and generic UI
must work without Tanso, credentials, or network access.

## Before changing the repository

Read completely:

1. this file;
2. every file under `docs/`; and
3. every fixture under `fixtures/golden-scenarios/`.

Treat this file as the product boundary, `docs/methodology.md` as the formula
source of truth, and golden fixtures as executable acceptance criteria. If
they conflict, stop and document the conflict before changing files.

## Product boundary

The forecaster consumes a read-only snapshot supplied by an adopting host.
The neutral input includes:

- `schemaVersion`;
- `methodologyVersion`;
- explicit `asOf` date;
- `period: { startDate, endDate, allocation, lowBalanceThreshold }`;
- current credit balance at the start of `asOf`;
- complete daily usage history for every date in
  `[period.startDate, asOf)`, including zero-use days;
- explicit `lookbackDays`;
- explicit low, base, and high burn multipliers;
- an explicit low-balance threshold; and
- optional dated future balance deltas.

Missing forecast inputs are validation errors. Do not silently default them.

The forecaster returns:

- `schemaVersion` and `methodologyVersion` echoed unchanged;
- baseline daily burn;
- used-to-date credits;
- low, base, and high projected burn;
- projected ending balance and utilization;
- depletion date, when applicable;
- projected shortfall;
- scenario status;
- daily observed and projected chart points;
- structured warnings; and
- ordered calculation traces.

The core owns only deterministic forecast calculation and neutral validation.
It does not read or mutate live product state.

## Adopting-product boundary

The adopting product owns:

- source-of-truth balances and allocations;
- credit grants, deductions, reversals, expiration, and rollover;
- usage events, aggregation, and metric-event persistence;
- transactions and ledgers;
- authentication and authorization;
- subscription and entitlement state;
- payments, billing, and top-ups;
- persistence of inputs or results;
- data fetching and refresh behavior; and
- customer-facing CTA behavior when risk is detected.

The host supplies a consistent snapshot. The forecaster does not reconstruct
the source-of-truth balance from usage history or execute future balance
deltas. It models supplied deltas only for forecast purposes.

## Explicit exclusions

Do not implement:

- provider or infrastructure cost modeling;
- customer-value or EVE modeling;
- credit-weight recommendations;
- price, revenue, margin, or package calculations;
- plan-allocation recommendations;
- runtime quote or rules-engine operations;
- model publication, approval, rollout, or effective-time governance;
- wallets, grants, deductions, transactions, or ledgers;
- entitlement enforcement;
- billing or Stripe integration;
- usage-event ingestion or storage;
- authentication;
- machine-learning predictions; or
- product-specific behavior in neutral packages.

There is no `modelVersion` in the neutral forecast contract. Forecasts are
versioned only by `schemaVersion` and `methodologyVersion`.

## Determinism and dates

- Calculations must be pure, deterministic, and decimal-safe.
- Identical inputs must produce structurally identical results.
- Portable JSON encodes decimal quantities as canonical base-10 strings.
- Count fields such as `lookbackDays` are JSON integers.
- Never perform credit, usage, balance, rate, or multiplier arithmetic with
  binary floating-point numbers.
- All dates are explicit ISO 8601 date-only strings: `YYYY-MM-DD`.
- Do not call the system clock or generate a current date or timestamp.
- `asOf` is supplied by the host and is the first projected date.
- Observed daily usage covers `[period.startDate, asOf)`.
- Projection covers `[asOf, period.endDate)`.
- These half-open ranges prevent an observed day from also being projected.
- Daily history must cover every required observed calendar day. Zero usage is
  represented explicitly, not inferred from a missing row.
- `lookbackDays` and all scenario multipliers are required inputs, not hidden
  constants.
- Future balance deltas must carry explicit dates and amounts.
- Preserve ordered calculation traces sufficient to reproduce every result.
- Return structured validation failures and warnings. Never hide errors by
  returning null, an empty value, or an invented default.

## Package boundaries

Target packages:

- `@tansohq/credit-forecast-schema`: browser-compatible neutral inputs,
  results, warnings, traces, and validation errors;
- `@tansohq/credit-forecast-core`: validation orchestration, decimal-safe
  calculations, warnings, and traces;
- `@tansohq/credit-burndown-react`: optional controlled React components for
  embedding the forecast in a customer dashboard;
- delivery adapters for JSON and CSV snapshots; and
- optional product adapters, including Tanso.

Dependency rules:

- The core must not import React, an adapter, a product SDK, or a network
  client.
- The core must run offline and in modern browsers without Node-only APIs.
- The React package may depend on the neutral schema package and React peer
  dependencies. It must not import the core or own authentication,
  persistence, billing, networking, or CTA effects.
- Hosts inject snapshot data and handle refreshes, exports, and actions.
- Tanso-specific identifiers, credentials, copy, and behavior belong only in
  an optional Tanso adapter.
- Neutral schemas must not require Tanso UUIDs or product-specific entities.
- Product-specific metadata belongs under namespaced extensions and must not
  change neutral forecast semantics.

## MVP sequence

1. Define neutral schemas and deterministic methodology.
2. Make every golden fixture pass in the pure core.
3. Build `@tansohq/credit-burndown-react` as the primary customer-facing MVP.
4. Add JSON and CSV import/export adapters.
5. Add an optional hosted reference application and product adapters.

Do not duplicate forecast formulas in the UI. The UI presents core results.

The first UI must show:

- current balance and period context;
- usage-to-date and baseline daily burn;
- low, base, and high burndown projections;
- projected depletion date or ending balance;
- low-balance and shortfall warnings;
- daily chart points;
- calculation explanations; and
- host-configured export or CTA actions.

Use composable, controlled, accessible, responsive React components. Default
copy and styling must remain product-neutral and themeable.

## Domain language

- **Period allocation:** credits made available for the forecast period.
- **Current balance:** source-of-truth credits available at the start of
  `asOf`.
- **Daily usage:** credits consumed on one explicit calendar date.
- **Used to date:** sum of supplied daily usage in the current period through
  the end of the day before `asOf`.
- **Lookback window:** explicit observed days used to calculate baseline burn.
- **Baseline daily burn:** methodology-defined daily rate calculated from the
  supplied lookback window.
- **Scenario multiplier:** explicit factor applied to baseline burn for low,
  base, or high projection.
- **Future balance delta:** a dated, forecast-only addition or subtraction
  supplied by the host.
- **Depletion date:** first projected date the balance reaches the
  methodology-defined depleted state.
- **Shortfall:** credits required to avoid a negative projected ending
  balance.
- **Status:** neutral scenario classification based on depletion and the
  supplied low-balance threshold.

Do not use balance, allocation, usage, burn, utilization, or shortfall as
interchangeable terms.

## Quality bar

Work is not ready until:

- every golden fixture passes without network access or credentials;
- every fixture supplies and asserts `schemaVersion` and
  `methodologyVersion`;
- golden fixtures cover zero usage, steady burn, changing burn, short
  lookback, future deltas, low balance, depletion, shortfall, and scenario
  ordering;
- all dates are explicit and no result depends on execution time or timezone;
- repeating decimal results follow the methodology's fixed precision and
  rounding rule;
- complete history and missing-day validation are tested;
- low, base, and high outputs use only supplied multipliers;
- chart points agree with summary results;
- every status, warning, and depletion date is traceable to explicit inputs;
- identical inputs produce identical outputs; and
- neutral packages require no product credentials or identifiers.

## Scope discipline

Ship the smallest trustworthy burndown forecaster. Do not preserve pricing
estimator concepts for compatibility. Do not add adjacent billing, metering,
pricing, wallet, or publication features. Adapters and hosts remain
replaceable; the deterministic forecast stays portable.
