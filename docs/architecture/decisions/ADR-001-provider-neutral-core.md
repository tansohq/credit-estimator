# ADR-001: Provider-neutral deterministic forecast core

**Date:** 2026-07-21

**Status:** Accepted

**Deciders:** Project maintainers
**Review trigger:** A proposed core dependency on product state, a network
service, authentication, persistence, billing, or a product-specific identifier

## Context and problem statement

Companies need to show customers how quickly they are consuming credits and
whether the current balance will last through the plan period. The same
forecast must work inside different product dashboards, in a browser, in a
backend process, and from exported JSON.

The adopting product already owns the authoritative balance, usage history,
plan period, and account state. The forecast project should calculate from a
read-only snapshot of that state without becoming another wallet, ledger, or
billing system.

The architectural question is whether forecasting should depend on a hosted
service or product data model, live in the UI, or run in a provider-neutral
deterministic core.

## Decision drivers

- Identical snapshots must produce identical forecasts.
- Forecasting must work locally without credentials or network access.
- A product dashboard must not depend on forecast-service availability.
- Neutral schemas must work for Tanso and other adopting products.
- The source product must remain authoritative for balances and transactions.
- Forecast formulas must not be duplicated across UI and integration layers.
- Dates must behave consistently across browsers, servers, and time zones.
- Calculation inputs and results must remain portable and explainable.

## Considered options

1. **Product-specific forecast:** Implement calculations against each adopting
   product's wallet, transaction, and account models.
2. **Hosted forecast service:** Require the UI or adopting product to send live
   data to a central forecast API.
3. **UI-owned forecast:** Implement the formulas directly in the embeddable
   components.
4. **Provider-neutral core:** Calculate from a versioned, read-only neutral
   snapshot and put product translation at the edge.

## Decision outcome

**Chosen option:** Provider-neutral core.

The core accepts a complete `ForecastInput` snapshot and returns a
`ForecastResult`. It owns deterministic calculations for:

- observed and projected burn rate;
- projected balance through the plan period;
- estimated depletion date when depletion occurs;
- credits remaining at period end;
- low, base, and high usage scenarios;
- low-balance, depletion, and shortfall status; and
- calculation breakdowns, warnings, and explanations.

The input snapshot is read-only. It contains explicit `asOf`, nested period
boundaries and allocation, current balance at the start of `asOf`, complete
daily history for `[period.startDate, asOf)`, lookback window, scenario
multipliers, low-balance threshold, and any dated future balance deltas
required by the methodology. Projection covers `[asOf, period.endDate)`. The
core does not discover, refresh, or reconcile that data.

Adopting products own:

- wallet balances and credit pools;
- grants, deductions, reversals, expiration, and rollover;
- transactions and ledgers;
- usage-event persistence;
- authentication and authorization;
- subscriptions, payments, top-ups, and billing; and
- fetching, assembling, and refreshing the forecast snapshot.

Optional adapters translate already-fetched product snapshots into
`ForecastInput`. They do not change the core contract or dependency direction.

## Required constraints

1. `packages/core` depends only on provider-neutral schemas and decimal-safe
   calculation dependencies.
2. The core imports no adapter, product SDK, network client, storage client, or
   authentication library.
3. The core performs no network, persistence, logging, telemetry, billing, or
   wallet side effects.
4. Inputs are immutable read-only snapshots. The core never mutates balances,
   usage observations, or caller-owned objects.
5. Neutral schemas require no Tanso UUID or identifier from another product.
   Adapter-specific identifiers may remain at the adapter boundary or in a
   namespaced extension that does not affect forecast arithmetic.
6. Every input and result includes `schemaVersion` and `methodologyVersion`.
   The result echoes both values unchanged.
7. Calendar inputs use ISO 8601 date-only strings (`YYYY-MM-DD`). Generated
   timestamps, local time zones, and environment clocks are excluded from the
   deterministic calculation payload.
8. Missing balance, allocation, usage, lookback, period, threshold, or scenario
   inputs are not silently defaulted. Any documented identity scenario is
   explicit in the schema or methodology.
9. Portable JSON encodes decimal quantities as canonical base-10 strings.
   Count fields such as `lookbackDays` are integers. Rates, quantities,
   balances, and credits are never calculated with binary floating point.
10. Browser and server execution of the same input produce structurally
    identical results.
11. Runtime forecasting can execute locally. A hosted API may wrap the core,
    but it is never required by the core or embeddable UI.
12. Presentation packages contain no forecast formulas.

## Positive consequences

- Products can embed forecasting without sending customer usage to another
  service.
- A hosted forecast-service outage cannot break an embedded local forecast.
- Tanso and other products share the same methodology without sharing data
  models.
- Golden scenarios can run offline without credentials or product fixtures.
- Forecasts remain reproducible from the exact input snapshot.
- Wallet, ledger, and billing ownership stays unambiguous.
- UI, JSON, CSV, and API delivery paths can display the same result.

## Negative consequences and mitigations

- **Hosts must assemble a complete snapshot:** Adopters need a translation
  step. Mitigation: publish small adapter contracts, examples, and conformance
  fixtures.
- **Snapshots can become stale:** A forecast cannot know whether source data
  changed after calculation. Mitigation: the host controls refresh behavior
  and may display its own retrieval time outside the deterministic payload.
- **Date-only arithmetic needs explicit rules:** Calendar boundaries can be
  interpreted differently. Mitigation: specify interval inclusion and
  day-count behavior in the methodology and cover boundary cases in fixtures.
- **Neutral schemas may omit product detail:** Product-specific state cannot
  leak into arithmetic implicitly. Mitigation: add broadly useful neutral
  fields deliberately; keep display-only metadata in namespaced extensions.

## Why the alternatives were rejected

### Product-specific forecast

It would couple formulas to one wallet and transaction model, require separate
implementations for each adopter, and make provider-neutral fixtures
impossible.

### Hosted forecast service

It would add network latency, availability, credential, and customer-data
handling requirements to a calculation that can run locally.

### UI-owned forecast

It would duplicate methodology in presentation code and allow browser and
server results to drift.

## Compliance and verification

- Run dependency-boundary checks before each package release.
- Run every golden scenario without network access or credentials.
- Assert structurally identical results for repeated identical inputs.
- Run the same fixtures in Node.js and a browser-compatible test environment.
- Verify every input and result includes matching `schemaVersion` and
  `methodologyVersion` values.
- Test ISO date-only period boundaries independently of host time zone.
- Search neutral schemas and fixtures for required product UUIDs.
- Verify core execution performs no external calls or persistent writes.
- Review this ADR before adding any product lookup, wallet mutation, data
  fetch, authentication, or billing behavior to the core.

## Links

- [Architecture overview](../../architecture.md)
- [Product scope](../../product-scope.md)
- [Methodology](../../methodology.md)
- [Optional Tanso adapter boundary](../../tanso-integration.md)
- [ADR-002: Result-controlled React UI](ADR-002-injected-react-ui.md)
- [Golden scenarios](../../../fixtures/golden-scenarios/README.md)
