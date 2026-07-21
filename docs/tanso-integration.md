# Optional Tanso Adapter Boundary

## Purpose

Tanso is one optional adopting product. It is not required by the estimator's
schemas, core calculations, CLI, hosted API, portable rules engine, or generic
React calculator.

When a team chooses Tanso, the responsibilities are:

    Estimator: design, forecast, explain, recommend, and quote
    Tanso adapter: translate stable neutral keys and contracts
    Tanso: meter, allocate, enforce, transact, persist, and reconcile

Removing the Tanso adapter must not affect offline estimation or local quote
evaluation.

## Conditional Tanso capabilities

For an integration that adopts Tanso, Tanso may provide:

- credit models and denominations;
- customer credit pools and balances;
- grants, deductions, expiration, rollover, and reversals;
- plan credit allocations;
- feature-to-credit-model associations;
- usage events with usage, provider cost, and customer revenue;
- hard-limit enforcement;
- ordered pool draw and draw limits;
- transaction history; and
- subscription and Stripe billing infrastructure.

These capabilities describe Tanso, not requirements of the estimator.

## Adapter location and dependency direction

Tanso integration is split into a headless package and an optional React
package:

    packages/adapters/tanso/
    packages/ui-tanso-react/

`packages/adapters/tanso` owns mapping, validation, publication, telemetry
translation, and Tanso-specific clients. It must not depend on React or either
UI package. `packages/ui-tanso-react` owns only optional review, confirmation,
and publication controls and may depend on the headless adapter and generic
React calculator. Neutral packages must never import either Tanso package, a
Tanso SDK, Tanso Java entity class, credential, or identifier.

The permitted dependency direction is:

    Tanso adapter -> neutral schema / adapter contracts
    Tanso React UI -> Tanso adapter / generic React UI / neutral schema

The reverse dependency is forbidden.

## Optional Tanso React UI

The generic calculator remains useful when both Tanso packages are absent.
Actions such as **Publish weights to Tanso** live only in
`packages/ui-tanso-react`. They may wrap the neutral calculator or compose
beside it, receive the current approved model, and invoke a configured
headless Tanso publisher. They do not alter the calculator's input,
estimation, or export contracts.

Tanso UI components may render capability checks, stable-key mapping status,
confirmation, and publication receipts. The embedding host owns credential
acquisition and storage and injects configured adapter operations. The UI must
not add wallet creation, top-up, Stripe configuration, or runtime entitlement
behavior to the estimator. Product-specific copy and identifiers remain
inside the Tanso UI package and namespaced extensions.

## Neutral identifiers

Portable models use stable keys:

- `metricKey`;
- `planKey`;
- `productKey`; and
- `segmentKey`.

They do not contain required Tanso UUIDs. The Tanso adapter owns key
resolution and may maintain its own mapping to Tanso resources.

Optional Tanso metadata must be isolated under a namespace such as:

    {
      "extensions": {
        "com.tanso": {
          "creditModelRef": "adapter-managed-reference"
        }
      }
    }

Neutral calculations must ignore unknown extensions. A field that changes
credit arithmetic belongs in the neutral schema, not only in an extension.

## Existing integration gap

Tanso currently deducts credits using a one-to-one relationship between event
usage units and credit units. It does not yet expose a declarative
metric-weight or conversion-rule table.

The estimator can recommend and publish variable weights, but direct Tanso
enforcement requires a compatible Tanso capability. A temporary integration
could submit normalized usage units, but normalization must remain explicit
and versioned; it must not become hidden estimator behavior.

Purchased credit grants and self-service top-ups remain runtime product and
billing concerns. They are not implemented by the estimator.

## Integration principles

- The estimator and Tanso do not share a database.
- The estimator never writes directly to a Tanso database.
- Core calculations and quotes require no Tanso credentials.
- The core and rules engine make no network calls.
- Tanso translation occurs only in the optional adapter.
- The Tanso adapter is headless; optional React controls are isolated in
  `packages/ui-tanso-react`.
- The estimator does not duplicate Tanso wallets, ledgers, entitlements,
  subscriptions, or billing.
- Tanso is authoritative for Tanso-managed runtime state and transactions.
- The published estimator model is authoritative for the recommendation and
  rule version it contains.
- A Tanso-backed live request evaluates the published model locally or through
  a runtime controlled by the adopting product; it does not call the hosted
  estimator API.

## Neutral published-model contract

A portable published model contains at least:

- `schemaVersion`;
- `methodologyVersion`;
- `modelVersion`;
- currency and denomination;
- global economic assumptions;
- stable metric keys and credits per unit;
- stable plan keys and recommended allocations;
- deterministic quote rules;
- calculation trace summaries;
- warnings and confidence;
- approval metadata; and
- an explicit `effectiveAt` timestamp.

The calculation payload is deterministic and contains no generated timestamp.
Approval and `effectiveAt` belong to the publication envelope.

Illustrative neutral model:

```json
{
  "schemaVersion": "1.0",
  "methodologyVersion": "1.0",
  "modelVersion": "2026-07-20.1",
  "currency": "USD",
  "denomination": "AI_CREDITS",
  "assumptions": {
    "realizedPricePerCredit": 0.01,
    "targetGrossMargin": 0.70,
    "targetValueCapture": 0.05,
    "maximumValueCapture": 0.10
  },
  "metricRules": [
    {
      "metricKey": "agent.deep_research",
      "creditsPerUnit": 20,
      "estimatedUnitCost": 0.02,
      "confidenceAdjustedValue": 4.00,
      "expectedGrossMargin": 0.90,
      "status": "FEASIBLE"
    }
  ],
  "planRecommendations": [
    {
      "planKey": "pro",
      "recommendedMonthlyCredits": 5000
    }
  ]
}
```

No field in this model requires Tanso.

## Optional Tanso publication flow

1. The estimator validates a model and produces an immutable recommendation.
2. Automated analysis may propose changes, but it does not activate them.
3. An authorized reviewer explicitly approves a specific `modelVersion` and
   `effectiveAt` value.
4. The Tanso adapter resolves stable keys to Tanso resources.
5. The adapter publishes with an idempotency key and returns a receipt.
6. Tanso stores or activates the translated configuration at the approved
   effective time.
7. The adopting runtime evaluates that version locally and uses Tanso for
   wallet, entitlement, and transaction effects.
8. Tanso telemetry may later be exported through the neutral telemetry-import
   adapter for calibration proposals.

If Tanso is unavailable, offline estimation and local quoting continue to
work. Publication can retry without changing the approved model payload.

## Adapter-specific responsibilities

The Tanso adapter may:

- map stable keys to Tanso identifiers;
- translate neutral model rules into supported Tanso resources;
- validate feature compatibility before publication;
- publish an approved model idempotently;
- return product-specific publication receipts under `extensions["com.tanso"]`;
  and
- translate Tanso telemetry into neutral observations.

It must not:

- change credit weights to fit product limitations without a warning and a
  new approval;
- make the neutral core import Tanso types;
- require Tanso identifiers in portable fixtures;
- publish an unapproved recommendation;
- choose an effective timestamp implicitly; or
- put a live request on the hosted estimator API's availability path.

See [architecture.md](architecture.md) for the generic adapter contracts and
[ADR-001](architecture/decisions/ADR-001-provider-neutral-core.md) for the
provider-neutral decision. See
[ADR-002](architecture/decisions/ADR-002-injected-react-ui.md) for the generic
UI injection boundary.
