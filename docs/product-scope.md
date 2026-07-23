# Product Scope: Credit Burndown Forecaster

## Executive summary

The Credit Burndown Forecaster is an embeddable, provider-neutral component
that forecasts credit or usage runway from observed host data. Companies can
embed it in customer dashboards or run the same deterministic core as a
standalone browser or Node.js library.

Customers see how quickly they are using credits, whether credits will last
through the current period, when depletion is likely, and how much risk exists
under different usage scenarios.

The core runs locally and deterministically. Tanso is one optional adapter,
not a required service or architectural dependency.

## Product promise

A company can add a trustworthy credit forecast to its dashboard without
giving the forecaster control of balances, billing, usage events, or customer
accounts.

The same explicit input produces the same result in a browser, Node.js process,
test, or compatible host backend. Live customer views do not require an
estimator service or network call when the core runs locally.

The delivery model has three implemented paths:

1. standalone browser or Node.js library execution, including the local demo;
2. a result-controlled React widget; and
3. an optional pure Tanso adapter that maps a complete host-supplied snapshot
   and explicit assumptions into neutral input.

Standalone does not mean a shipped CLI. No CLI or hosted forecast API is part
of the MVP. No automatic Tanso source connector is included.

## Users

Primary user: a customer monitoring credits inside an AI product dashboard.

Adopting user: the product or engineering team embedding the forecast and
supplying the source-of-truth snapshot.

## Problem

Credit balances show what remains, but rarely answer what customers need to
know:

- Is current usage normal?
- Will this balance last until renewal or period end?
- When could credits run out?
- What happens if usage increases or decreases?
- How large is the likely shortfall?
- Which observations and assumptions produced the forecast?

Companies can build this independently, but date boundaries, missing usage
days, scenario math, balance changes, and chart consistency create repeated
implementation work. A portable deterministic forecaster provides one
explainable contract.

## Core hypothesis

Customers make better usage decisions when a dashboard turns historical
credit usage into a clear, explainable burndown projection.

The hypothesis is supported when adopting companies can embed the component
with their own data and customers can correctly understand remaining runway,
depletion risk, and scenario differences without support intervention.

It is unsupported if the forecast cannot be trusted, requires product-specific
state, or does not change customer decisions.

## Neutral input snapshot

The adopting host supplies a complete read-only snapshot containing:

- `schemaVersion`;
- `methodologyVersion`;
- `asOf`, the first projected date;
- `period: { startDate, endDate, allocation, lowBalanceThreshold }`;
- current balance available at the start of `asOf`;
- complete daily usage history for every date in
  `[period.startDate, asOf)`, with zero-use days represented explicitly;
- explicit `lookbackDays`;
- explicit low, base, and high burn multipliers;
- optional dated future balance deltas.

All dates are ISO 8601 date-only values (`YYYY-MM-DD`). The host supplies
`asOf`; the forecaster never reads the system clock or generates a current
date. Observed usage covers `[period.startDate, asOf)`. Projection covers
`[asOf, period.endDate)`. These half-open ranges prevent day overlap.

Portable JSON represents decimal quantities as canonical base-10 strings.
Only count fields such as `lookbackDays` use JSON integers. Forecast arithmetic
must not use binary floating-point values.

The host remains responsible for snapshot consistency. The forecaster does
not derive or correct the source-of-truth balance from usage history.

## Forecast output

The deterministic result includes:

- `schemaVersion` and `methodologyVersion` echoed unchanged;
- baseline daily burn from the explicit lookback window;
- period usage to date;
- low, base, and high projected burn;
- projected ending balance for each scenario;
- projected utilization for each scenario;
- depletion date when applicable;
- projected shortfall;
- neutral status classification;
- daily observed and projected chart points;
- structured warnings; and
- ordered calculation traces.

The result contains no generated timestamp. Every output must be reproducible
from the input alone.

## Ownership boundary

### Forecaster owns

- neutral snapshot and result schemas;
- snapshot validation;
- baseline burn calculation;
- low, base, and high deterministic projections;
- application of supplied future balance deltas;
- ending balance, utilization, depletion, and shortfall calculations;
- neutral scenario status classification;
- daily chart-point generation;
- structured warnings; and
- explainable calculation traces.

### Adopting product owns

- source-of-truth balances and period allocations;
- credit grants, deductions, reversals, expiration, and rollover;
- usage-event collection, aggregation, and persistence;
- wallets, transactions, and ledgers;
- authentication and authorization;
- subscription and entitlement state;
- payments, billing, and top-ups;
- snapshot persistence and refresh timing;
- customer/account mapping; and
- CTA behavior, navigation, and side effects prompted by forecast status.

The forecaster may model an explicitly supplied future balance delta. It never
creates, schedules, or executes that balance change.

## MVP scope

### Core foundation

1. Product-neutral TypeScript schemas.
2. Deterministic, decimal-safe forecast calculations.
3. Explicit date and history validation.
4. Low, base, and high projections.
5. Ending balance, utilization, depletion date, shortfall, and status.
6. Daily chart points, structured warnings, and calculation traces.
7. Golden fixtures executable without credentials or network access.

### Primary MVP delivery

The primary MVP implements an embeddable React package as
`@tanso-hq/credit-burndown-react`, the calculation package as
`@tanso-hq/credit-forecast-core`, and its neutral contracts as
`@tanso-hq/credit-forecast-schema`. Registry publication remains a release
step.

The React package should let customers see:

- current balance and period progress;
- used-to-date and baseline burn;
- low, base, and high burndown lines;
- projected ending balance or depletion date;
- low-balance and shortfall warnings;
- daily observed and projected values; and
- an accessible explanation of the calculation.

It is controlled and composable. The host supplies the snapshot, responds to
changes or actions, controls data refresh, and chooses any export or CTA
behavior. The component owns no authentication, storage, billing, top-up, or
network logic.

### Later delivery

- Automatic Tanso source retrieval and other product adapters
- Optional hosted API wrapper as a deferred, non-MVP deployment choice
- Additional framework wrappers when committed adopters require them
- Package registry publication and public contribution policy

The pure Tanso mapping adapter is implemented. Current integrations must still
supply complete, ordered neutral daily usage buckets, the start-of-`asOf`
balance, and all forecast assumptions. Source retrieval remains host-owned.

## Explicit exclusions

- Provider and infrastructure cost calculations
- Customer-value or EVE modeling
- Credit-weight recommendations
- Revenue, gross-profit, or margin forecasts
- Plan and package recommendations
- Credit pricing design
- Runtime credit quote or rules engine
- Model publication, approval, effective timestamps, or rollout governance
- Wallet or balance mutation
- Credit grants, deductions, transactions, or ledgers
- Usage-event ingestion or persistence
- Entitlement enforcement
- Authentication
- Subscription or billing workflows
- Stripe top-ups
- Automated customer actions
- Machine-learning forecasts in the deterministic core

The neutral contract uses `schemaVersion` and `methodologyVersion`. It does
not use `modelVersion`.

## First user journey

1. Customer opens the usage page in an adopting product.
2. Host loads its source-of-truth balance, allocation, period, and complete
   daily usage snapshot.
3. Embedded core calculates the forecast locally.
4. UI shows historical burn and low, base, and high projections.
5. Customer sees projected period-end balance, likely depletion date, or
   shortfall.
6. Customer opens the trace to understand the lookback rate, multipliers, and
   future deltas used.
7. If action is needed, the host decides which CTA to show and what it does.

## Roadmap ownership

| Capability | Forecaster owns | Adopting product owns | Stage |
|---|---|---|---|
| Neutral snapshot validation | Schemas and deterministic validation | Supplies complete snapshot | Core MVP |
| Baseline daily burn | Formula and trace | Supplies daily history and lookback | Core MVP |
| Low/base/high forecast | Scenario calculation and chart points | Supplies multipliers | Core MVP |
| Ending balance and utilization | Calculation and trace | Supplies current balance and allocation | Core MVP |
| Depletion and shortfall | Calculation, status, warning | Chooses customer action | Core MVP |
| Future balance deltas | Forecast-only application | Supplies and executes real changes | Core MVP |
| Embeddable React UI | Neutral accessible presentation | Embeds, themes, and supplies data | Primary MVP |
| JSON/CSV adapters | Neutral serialization mapping | Imports or exports product data | Implemented |
| Local reference demo | Demonstrates browser-local integration | Runs or deploys it if useful | Implemented locally |
| Tanso OSS adapter | Validates and maps an already-fetched, already-consistent Tanso forecast snapshot plus explicit assumptions | Owns source data, credentials, aggregation, consistency, and APIs | Implemented |
| Automatic Tanso source connector | — | Fetches and assembles trustworthy source inputs | Deferred; not implemented |
| Optional hosted API | Wraps the same neutral core without new formulas | Owns deployment, authentication, and operations | Deferred; non-MVP |
| Balance and allocation truth | — | Full ownership | Outside |
| Usage events and persistence | — | Full ownership | Outside |
| Wallets and ledgers | — | Full ownership | Outside |
| Authentication and entitlements | — | Full ownership | Outside |
| Billing and top-ups | — | Full ownership | Outside |
| CTA behavior and side effects | Exposes neutral status | Full ownership | Outside |

## Success criteria

- Every golden fixture passes offline with no credentials.
- Identical snapshots produce identical results across supported runtimes.
- Every input and output includes `schemaVersion` and
  `methodologyVersion`; neither requires `modelVersion`.
- No calculation reads the clock, timezone, environment, or network.
- Portable JSON uses canonical base-10 strings for decimal quantities and
  integers only for count fields.
- Missing dates, missing history days, and incomplete lookback windows fail
  validation instead of receiving defaults.
- Zero-usage periods produce valid, explainable results.
- Low, base, and high scenario ordering follows the supplied multipliers.
- Summary values and daily chart points agree.
- Depletion dates, shortfalls, statuses, and warnings are traceable to ordered
  calculation steps.
- `@tanso-hq/credit-forecast-core` runs in a browser without product SDKs.
- `@tanso-hq/credit-burndown-react` can be embedded without Tanso and without
  owning authentication, networking, persistence, billing, or CTA behavior.
- The optional Tanso mapping adapter can be removed without changing neutral
  schemas, core calculations, JSON/CSV exchange, or the React UI.
- An adopting team can integrate its snapshot and render a useful forecast
  without rebuilding forecast formulas.

## Open decisions

- Whether authoritative Tanso source APIs will support an automatic connector
- Chart rendering dependency and bundle-size budget
- License and package-release process
- Minimum browser support
- Whether committed non-React adopters justify a Web Component
- Evidence and thresholds for customer-understanding success

See [methodology.md](methodology.md) for formula semantics,
[architecture.md](architecture.md) for dependencies and data flow, and
[tanso-integration.md](tanso-integration.md) for the optional Tanso boundary.
