# Product Scope: Credit Estimator

## Executive summary

The Credit Estimator is a standalone, product-neutral tool for designing and
publishing credit rules for AI products. It converts workload, provider cost,
customer value, confidence, and margin assumptions into explainable credit
weights, plan recommendations, forecasts, and portable model specifications.

The repository name reflects its origin, but Tanso is only one optional
integration. The estimator must remain fully useful offline and without any
adopting product, credentials, or network access.

## Product promise

One neutral model should be usable through:

- an embedded library;
- a command-line workflow;
- a generic hosted API;
- JSON or CSV files;
- a local deterministic rules engine;
- an optional embeddable React calculator; and
- optional adapters for Tanso or other adopting products.

Changing the delivery channel must not change the calculation result.

## Target user

The primary user is a product, pricing, or FinOps leader at an AI software
company. The initial use case is designing or revising a credit system before
an adopting product implements balances, metering, entitlement enforcement,
or billing.

## Problem

AI companies often choose credit weights and plan allocations using rough
cost multipliers or intuition. That makes it difficult to explain:

- why one action consumes more credits than another;
- whether a plan remains profitable under heavy usage;
- whether customers receive sufficient value;
- how many credits a customer will need;
- which model version produced a runtime quote; and
- when weights should be recalibrated.

## Core hypothesis

We believe AI product and pricing teams have difficulty translating variable
AI workloads and customer value into a simple credit system.

We believe a transparent, deterministic estimator will solve this by exposing
every assumption, calculating economic guardrails, and producing portable,
versioned recommendations and rules.

The hypothesis is supported when design partners can produce, defend,
publish, and locally evaluate a usable credit model without rebuilding the
calculations or depending on a vendor service during live requests.

It is unsupported when users routinely choose weights outside the model
because they do not trust or understand its recommendations.

## Estimator responsibilities

The estimator owns the product-neutral logic for:

- provider and total unit-cost calculation;
- EVE and customer-value modeling;
- confidence adjustment;
- credit-weight guardrails and recommendations;
- low, base, and high forecasts;
- plan and package recommendations;
- calibration analysis;
- automated recommendation proposals;
- versioned model schemas and calculation traces; and
- deterministic credit quotes from a published model.

Automated recommendations are advisory. They never update a published model
without explicit approval and an effective timestamp.

## Adopting-product responsibilities

An adopting product owns all runtime state and side effects:

- wallet balances and credit pools;
- grants, deductions, reversals, expiration, and rollover;
- transactions and ledgers;
- entitlement and hard-limit enforcement;
- subscription state;
- payments and Stripe top-ups;
- runtime metric-event persistence; and
- model storage, rollout, rollback, and effective-version selection.

The estimator's quote operation returns required credits. The adopting
product decides whether to authorize the action and how to record it.

## Deterministic quote operation

The portable rules engine evaluates:

    metricKey + quantity + context + modelVersion -> required credits

`context` may contain neutral keys such as `productKey`, `planKey`, and
`segmentKey`, plus namespaced extensions. The result includes the three
required versions, the applied rule, warnings, and a calculation trace.

The quote operation:

- is pure and deterministic;
- performs no network calls;
- has no dependency on the hosted estimator API;
- does not read or mutate balances;
- does not enforce entitlements; and
- does not persist metric events or transactions.

## MVP scope

### In scope

1. Structured input for assumptions, metrics, customer drivers, and scenarios.
2. Deterministic metric economics and recommended weights.
3. Low, base, and high demand, revenue, cost, and margin forecasts.
4. Plan and package allocation recommendations.
5. Versioned neutral JSON input and output for offline files and a CLI.
6. Golden scenarios that execute without network access.
7. Calculation traces sufficient to explain every recommendation.

### Explicitly deferred from the first MVP

- Hosted API implementation
- CSV adapter implementation
- Webhook and product adapter implementation
- Runtime model publication automation
- Production telemetry ingestion
- Automatic recalibration execution
- Multi-user review and approval workflows
- The optional embeddable React calculator and hosted reference application
- Machine-learning prediction

These are sequencing decisions, not changes to the ownership boundary. For
example, calibration and automated recommendation logic belong to the
estimator even though their implementation follows methodology validation.

### Permanently outside estimator ownership

- Wallets, balances, grants, deductions, and ledgers
- Runtime entitlement or hard-limit enforcement
- Subscription lifecycle management
- Payments and Stripe top-ups
- Runtime metric-event persistence
- Product-specific customer or account state

## First user journey

1. Define global economic assumptions.
2. Add five to ten representative billable metrics.
3. Define one to three customer segments and workload drivers.
4. Run low, base, and high scenarios.
5. Review weights, plan allocations, economics, and warnings.
6. Export a versioned result through JSON or the CLI.
7. Later, approve a model version for publication with an effective timestamp.
8. Evaluate quotes locally in the adopting product's request path.

## Roadmap ownership

| Capability | Estimator owns | Adopting product owns | Delivery stage |
|---|---|---|---|
| Cost and EVE calculations | Formulas, schemas, traces | Supplies approved inputs | MVP |
| Credit-weight recommendations | Guardrails and proposals | Approves commercial policy | MVP |
| Low/base/high forecasts | Deterministic scenarios | Supplies product workload assumptions | MVP |
| Plan/package recommendations | Allocation and utilization analysis | Creates and sells actual plans | MVP |
| Offline library and CLI | Neutral calculation surfaces | Embeds or invokes them | MVP |
| JSON import/export | Neutral model and result contracts | Stores or transfers files | MVP |
| Embeddable React calculator | Controlled, neutral estimation workflow and explainable results | Injects local or remote estimation and optional export behavior | Next, after engine validation |
| Hosted reference calculator | Demonstrates local and hosted estimation modes | Supplies deployment, authentication, and persistence if desired | Next, after engine validation |
| CSV import/export | Neutral tabular mapping | Supplies product mappings | Next |
| Generic hosted API | Transport wrapper around neutral core | Chooses whether to call it | Next |
| Portable rules engine | Local quote evaluation | Hosts it in the live request path | Next |
| Calibration | Error analysis and recommendation proposals | Exports telemetry observations | Later |
| Automated recommendations | Produces reviewable proposals | Approves or rejects proposals | Later |
| Model publication | Neutral publication contract and adapters | Stores, activates, and rolls back rules | Later |
| Runtime credit quote | Calculates required credits | Selects effective model and supplies context | Later |
| Wallets and ledgers | — | All balances and transactions | Outside |
| Entitlements and limits | — | All authorization and enforcement | Outside |
| Billing and top-ups | — | All payments and subscription state | Outside |
| Metric-event persistence | — | All runtime event storage | Outside |

## Success criteria

- A first-time user can create a model using documented examples.
- Every weight and quote is traceable to explicit inputs and formulas.
- Infeasible metrics are clearly identified.
- Repeated calculations are deterministic across delivery channels.
- Every calculation input supplies `schemaVersion`, `methodologyVersion`, and
  `modelVersion`; every output echoes them unchanged.
- A model version is not reused after any calculation-relevant input changes,
  and cache identity includes the canonical input or a deterministic digest.
  Estimate caching is deferred until canonicalization is specified.
- Neutral contracts use stable keys and require no product UUIDs.
- Golden scenarios pass without credentials or network access.
- A runtime can evaluate a published model locally when the hosted API is
  unavailable.
- Product adapters can be added without changing the core domain model.
- The generic calculator can run with a local estimator function, a compatible
  hosted API, or an embedding host without changing its component contract.

## Optional embeddable calculator

After the deterministic engine passes every golden scenario, the first UI
delivery should be an optional, controlled React component package rather
than a required API client or branded application. Its initial workflow
includes:

1. business and economic assumptions;
2. a metric and workload editor;
3. low, base, and high scenarios;
4. recommended credit weights;
5. cost-floor and value-supported ranges;
6. warnings for economically infeasible configurations;
7. calculation traces that explain each recommendation; and
8. JSON and CSV export actions.

The host injects estimation and export behavior. It may execute the core in
the browser, call any compatible estimator API, or embed the components in an
adopting product. The generic UI owns no authentication, networking, storage,
billing, or product-specific actions. The UI invokes estimation only after an
explicit **Calculate** submission, passes an `AbortSignal`, and rejects stale
responses by request sequence. Editing never causes an estimator call.

Export actions come from a host-supplied list of exporters, so the calculator
renders only formats that are actually configured. Tanso publication controls
belong in the optional `packages/ui-tanso-react` package; the headless
`packages/adapters/tanso` package remains free of React.

The package should expose composable controlled components, use neutral
default terminology, support CSS-variable theming, and meet keyboard,
semantic-markup, focus-management, and responsive-layout requirements. A Web
Component wrapper is deferred until at least two committed non-React adopters
cannot reasonably use the React package.

## Approved UI delivery constraints

- Publish the generic React package as `@tansohq/credit-calculator-react`.
- Support React peer versions exercised in CI, initially
  `^18.2.0 || ^19.0.0`.
- Use stable semantic CSS custom properties prefixed
  `--credit-calculator-*`, class names prefixed `credit-calculator-*`,
  low-specificity selectors, and no global reset.
- Package import must be SSR-safe and must not access `window` or `document`
  at module scope.
- Provide neutral English defaults through an injectable, typed `messages`
  contract with an exhaustive first-version key set for labels, help, status,
  result, and error text.
- Keep `packages/adapters/tanso` headless and place optional React publication
  controls in `packages/ui-tanso-react`.

## Decisions that must remain explicit

- Portable runtime targets beyond Node.js 20+ and modern browsers
- Repository license
- Accepted CSV dialect and lossless round-trip guarantees
- Context fields allowed to influence quote rules
- Model signature, provenance, and rollback requirements
- Acceptable forecast error and calibration thresholds
- Required evidence for confidence scores
- Target users and committed design partners

See [architecture.md](architecture.md) for package and data-flow boundaries and
[ADR-001](architecture/decisions/ADR-001-provider-neutral-core.md) for the
provider-neutral decision. The injected UI boundary is recorded in
[ADR-002](architecture/decisions/ADR-002-injected-react-ui.md).
