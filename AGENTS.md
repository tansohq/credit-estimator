# Credit Estimator Agent Guide

## Mission

Build a standalone, product-neutral estimator that helps AI product teams:

- define what one credit represents;
- recommend credits consumed by each billable metric;
- forecast monthly credit demand;
- test cost, value, and margin assumptions;
- recommend plan and package allocations;
- calibrate estimates and propose updated recommendations;
- export a versioned credit-model specification that can be evaluated locally;
  and
- present the same neutral workflow through an optional embeddable UI.

The repository name reflects the project's origin, not a runtime dependency.
The estimator must be useful without Tanso or any other adopting product.

## Core architectural principle

Tanso is one optional adapter, not the estimator's architecture.

The provider-neutral core must support the same model through:

1. offline library usage;
2. CLI usage;
3. a generic hosted API;
4. JSON and CSV import/export;
5. a portable deterministic credit-rules engine;
6. an optional embeddable React UI and reference calculator; and
7. optional adapters for Tanso and other products.

The core must not import an adapter package, require credentials, or perform a
network call. Transport, persistence, credentials, and product-specific
translation belong outside the core.

See [docs/architecture.md](docs/architecture.md),
[ADR-001](docs/architecture/decisions/ADR-001-provider-neutral-core.md), and
[ADR-002](docs/architecture/decisions/ADR-002-injected-react-ui.md).

## Ownership boundary

The estimator owns:

- provider and total unit-cost calculations;
- customer-value and EVE modeling;
- confidence-adjusted value calculations;
- cost-floor, value-supported, maximum-value, and recommended credit weights;
- low, base, and high forecasts;
- plan and package recommendations;
- calibration analysis and automated recommendation proposals;
- provider-neutral schemas and calculation traces;
- versioned, portable published credit models; and
- the deterministic quote operation:

      metricKey + quantity + context + modelVersion -> required credits

Adopting products own:

- wallet balances;
- credit grants, deductions, reversals, expiration, and rollover;
- transactions and ledgers;
- entitlement and hard-limit enforcement;
- subscription state;
- payments and Stripe top-ups;
- runtime metric-event persistence; and
- selection and storage of the model version effective for a live request.

The quote operation calculates required credits. It never checks a balance,
deducts credits, grants access, records a transaction, or persists an event.

## Dependency rules

- `packages/schema` defines neutral contracts, stable keys, versions, and
  extension conventions.
- `packages/core` may depend on `packages/schema`; it must not depend on the
  CLI, API app, or any adapter. Its pure calculation entry point must remain
  browser-compatible without Node.js polyfills.
- `packages/rules-engine` may depend on `packages/schema`; it must not depend
  on an adapter or a hosted estimator service.
- `packages/ui-react` is an optional controlled presentation layer. It may
  depend on `packages/schema` and React peer dependencies, but it must not
  require the core, API app, adapters, authentication, persistence, or a
  network client. Hosts inject estimation and export behavior.
- `packages/adapters/tanso` is headless. It must not import React or either UI
  package.
- `packages/ui-tanso-react` is an optional product-integration UI. It may
  depend on `packages/ui-react`, `packages/adapters/tanso`, and neutral
  schemas; no dependency may flow from those packages back into it.
- `packages/cli` and `apps/api` are delivery layers. They may call the core,
  rules engine, and configured adapters.
- `apps/calculator` is a reference host. It may compose `packages/ui-react`
  with local core execution or a compatible hosted API and format adapters;
  those choices must not leak into the generic component contract.
- Adapter packages may depend on neutral schemas. Adapter dependencies must
  never flow back into the core or rules engine.
- Product SDKs, credentials, UUIDs, and network clients are permitted only in
  the relevant adapter or delivery layer.

These rules are architectural constraints, not implementation suggestions.

## Stable identifiers and extensions

Neutral schemas use stable external keys such as:

- `metricKey`;
- `planKey`;
- `productKey`; and
- `segmentKey`.

They must not require Tanso UUIDs or identifiers from any adopting product.
Product-specific fields belong under a namespaced `extensions` object, for
example `extensions["com.tanso"]`. Unknown extensions must not change neutral
calculation semantics. An adapter resolves stable keys to product identifiers.

## Determinism, versions, and publication

- Every calculation and quote input explicitly supplies `schemaVersion`,
  `methodologyVersion`, and `modelVersion`. Every result, export, and
  published model echoes all three unchanged.
- A draft `modelVersion` identifies the caller's assumption snapshot. It does
  not imply approval, publication, or effectiveness.
- Reusing a `modelVersion` for different calculation-relevant input is
  invalid. Stateless calculations cannot detect historical reuse; delivery
  and publication layers enforce it. Never cache by `modelVersion` alone.
- Calculation payloads exclude generated timestamps, random values, and
  environment-dependent data.
- A publication envelope may include an explicitly supplied `effectiveAt`
  timestamp; it is not generated by the calculation engine.
- Runtime systems must be able to evaluate a published model locally.
- A live request must not depend on availability of `apps/api` or any hosted
  estimator service.
- Automated calibration or recommendation logic produces proposals only.
- No proposal may silently modify production rules.
- Publication requires explicit approval, an immutable model version, and an
  effective timestamp.
- Once published, the same model version and quote input must produce the same
  required-credit result.

## MVP

The first MVP validates the methodology through a pure calculation library,
neutral schemas, golden scenarios, JSON files, and a small CLI. It includes:

1. validation of customer, workload, metric, cost, and value assumptions;
2. cost floors, value-supported weights, feasibility warnings, and traces;
3. low, base, and high demand and margin scenarios; and
4. deterministic, versioned, provider-neutral output.

Do not build wallets, ledgers, entitlement logic, billing, a production API,
an embeddable UI, or product adapters until the methodology and portable
model contract are validated against the golden scenarios. Architecture
documentation may define those future boundaries.

## Domain language

- Metric: a billable product or agent action identified by `metricKey`.
- Metric volume: expected completed metric units in a period.
- Unit cost: provider and infrastructure cost per completed metric unit.
- Customer value: confidence-adjusted economic value per metric unit.
- Credit weight: credits consumed per completed metric unit.
- Realized price per credit: actual usage revenue divided by available
  credits, not the advertised list price.
- Cost floor: minimum credits needed to meet the target gross margin.
- Value-supported weight: credits justified by target value capture.
- Maximum value weight: maximum credits permitted by the value guardrail.
- Plan allocation: credits recommended for inclusion in a plan for a period.
- Scenario: a named set of explicit workload and cost multipliers.
- Published model: an immutable, approved, versioned set of credit rules with
  an effective timestamp.
- Quote: a deterministic evaluation of required credits with no wallet or
  entitlement side effects.

Do not use credits, tokens, usage units, provider cost, customer value,
balances, or transactions as interchangeable terms.

## Calculation requirements

- Use decimal-safe arithmetic for currency, rates, and credits.
- Keep formulas deterministic and side-effect free.
- Require explicit units and periods.
- Never silently substitute missing financial inputs.
- Return structured warnings for incomplete or infeasible inputs.
- Preserve calculation trace data sufficient to explain every recommendation
  and quote.
- Treat low, base, and high multipliers as inputs, not hardcoded constants.
- Keep automated recommendations separate from approved published rules.

The formula source of truth is [docs/methodology.md](docs/methodology.md).

## Integration rules

- No shared database with an adopting product.
- No direct access to an adopting product's database.
- No dependency on product-specific entity classes from neutral packages.
- No credentials required for core calculations or local quotes.
- No duplicated wallet, ledger, entitlement, subscription, or billing logic.
- Use versioned neutral JSON contracts at integration boundaries.
- Put every product translation in its own adapter.
- Import telemetry as neutral observations; do not make the core fetch it.
- Resolve cost catalogs outside a calculation and pass an immutable snapshot
  into the core.
- Keep estimator formulas out of presentation components. UI hosts call the
  core or a compatible API through an injected estimator function.
- UI estimation is explicit-submit by default. Editing an input must not
  automatically invoke the estimator.
- Injected estimators receive an `AbortSignal`; the UI must also reject stale
  completions using a monotonically increasing request sequence.
- All rejected values pass through the Zod-backed neutral error normalizer.
  Cancellation is detected from `signal.aborted`, not an exception class.
- Controlled UI input is immutable. Changes to input or estimator identity,
  explicit reset, and unmount abort and invalidate in-flight work.
- The UI renders only host-supplied exporters and normalizes estimation
  failures to the neutral error contract.
- Keep Tanso-specific actions, copy, credentials, and identifiers out of the
  generic UI. Headless Tanso behavior belongs in `packages/adapters/tanso`;
  React controls belong in `packages/ui-tanso-react`.

The optional Tanso boundary is documented in
[docs/tanso-integration.md](docs/tanso-integration.md).

## Quality bar

The golden scenarios in `fixtures/golden-scenarios/` are executable product
requirements. The engine is not ready until:

- every fixture passes without network access or credentials;
- every fixture supplies and asserts `schemaVersion`, `methodologyVersion`,
  and `modelVersion` in the calculation envelope;
- golden fixtures cover direct and decomposed unit cost, direct and
  confidence-adjusted value, direct and driver-based volume, plan allocation,
  scenario economics, warnings, and calculation traces;
- identical inputs produce identical outputs;
- every output carries all three required versions;
- every recommended weight exposes its guardrails and feasibility status;
- every quote identifies the applied model and rule;
- zero-volume and zero-revenue cases avoid invalid arithmetic;
- ordered scenario inputs produce ordered demand outputs; and
- neutral schemas require no product-specific identifiers.

## Scope discipline

Do not add a feature unless it tests the core hypothesis or is required for a
portable estimation and quote flow. Prefer explicit files and manual approval
over premature administration, collaboration, billing, or telemetry systems.
Adapters and delivery layers must remain replaceable.
