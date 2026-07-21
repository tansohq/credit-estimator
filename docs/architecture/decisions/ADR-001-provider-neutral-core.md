# ADR-001: Provider-neutral core with optional adapters

**Date:** 2026-07-20

**Status:** Accepted

**Deciders:** Project maintainers
**Review trigger:** A proposed neutral-schema dependency on a product SDK,
identifier, credential, network service, or runtime ledger

## Context and problem statement

The estimator originated near Tanso, but its calculations describe a general
credit-pricing problem. Teams need to run the same methodology offline, from a
CLI, behind a generic API, and inside an adopting product's runtime. They also
need JSON/CSV portability and optional integrations with Tanso or other
products.

A Tanso-centric core would couple neutral calculation rules to one product's
identifiers, availability, persistence model, and release cycle. It would also
make live credit quotes dependent on a remote estimator service or duplicate
wallet and ledger responsibilities.

The architectural question is where product-specific integration belongs and
which runtime behavior the estimator should own.

## Decision drivers

- Identical inputs must produce identical results across delivery channels.
- Core calculations and quotes must work offline without credentials.
- A live request must not depend on hosted estimator availability.
- Neutral schemas must be reusable by products other than Tanso.
- Product-specific identifiers and SDKs must not leak into core contracts.
- Runtime wallet, entitlement, billing, and ledger state already belongs to
  adopting products.
- Published rule changes require governance, approval, and safe activation.
- Optional integrations must be independently replaceable and testable.

## Considered options

1. **Tanso-centric core:** Build calculations around Tanso entities and make
   Tanso the primary runtime and publication contract.
2. **Provider-neutral core with optional adapters:** Define stable neutral
   schemas, pure calculations, and a portable rules engine; put Tanso and
   other products behind edge adapters.
3. **Independent implementation per adopting product:** Publish methodology
   prose and let each product reimplement calculations and runtime rules.

## Decision outcome

**Chosen option:** Provider-neutral core with optional adapters.

The core owns cost/value calculations, forecasts, plan recommendations,
calibration analysis, recommendation proposals, and traces. A separate
portable rules engine owns the deterministic quote operation:

    metricKey + quantity + context + modelVersion -> required credits

Adopting products own balances, grants, deductions, ledgers, entitlements,
subscriptions, payments, and runtime event persistence. Tanso is supported by
an optional adapter under `packages/adapters/tanso` and has no reverse
dependency into neutral packages.

## Required constraints

1. `packages/core` and `packages/rules-engine` do not import adapters.
2. Neutral packages contain no product SDKs, credentials, or network clients.
3. Neutral schemas use `metricKey`, `planKey`, `productKey`, and `segmentKey`,
   not required product UUIDs.
4. Product-specific metadata is isolated in namespaced extensions.
5. Every calculation or quote input supplies `schemaVersion`,
   `methodologyVersion`, and `modelVersion`; every output echoes them.
   A `modelVersion` is never reused for different calculation-relevant input,
   and caches do not use it as their sole key.
6. Runtime systems can evaluate an immutable published model locally.
7. The hosted API is a delivery option, not a live runtime dependency.
8. Automated recommendations create proposals only.
9. Publication requires explicit approval and `effectiveAt`.
10. Translation failures or unsupported rules are reported before activation;
    adapters never silently change weights.

## Positive consequences

- Offline library, CLI, API, JSON, CSV, and embedded runtime paths share one
  domain model.
- A Tanso outage or adapter removal cannot break neutral calculation or local
  quote evaluation.
- Other products can adopt the estimator without emulating Tanso entities.
- Golden fixtures remain portable and credential-free.
- Product SDK upgrades are isolated to their adapters.
- Ownership of money, balances, authorization, and transaction state remains
  unambiguous.
- Approved model versions can be audited from recommendation through runtime
  quote.

## Negative consequences and mitigations

- **More explicit contracts:** Neutral schemas and adapter boundaries require
  deliberate versioning. Mitigation: keep contracts small and version them
  from the first release.
- **Translation work per product:** Each adopting product needs a mapping
  adapter. Mitigation: publish common adapter interfaces and conformance
  fixtures.
- **Feature mismatch:** A product may not support every neutral rule.
  Mitigation: adapters report capabilities and reject unsupported publication
  before activation.
- **Local runtime distribution:** Products must store and deploy published
  models. Mitigation: define immutable artifacts, receipts, effective times,
  and future signature/verification policy.
- **Potential schema lowest-common-denominator:** Excessive neutrality can hide
  useful features. Mitigation: standardize broadly useful arithmetic fields
  and isolate genuinely product-specific metadata in extensions.

## Why the alternatives were rejected

### Tanso-centric core

Advantages would include faster initial Tanso integration and direct reuse of
Tanso identifiers. It was rejected because it creates vendor coupling,
requires product concepts in portable fixtures, and risks making live quotes
depend on Tanso or the hosted estimator.

### Independent implementation per product

Advantages would include maximum product autonomy and no shared runtime
package. It was rejected because formula, rounding, warning, and trace behavior
would drift, undermining deterministic results and model portability.

## Compliance and verification

- Add dependency checks when packages are created.
- Keep provider-independent and deterministic golden scenarios mandatory.
- Add adapter conformance fixtures before publishing adapters.
- Verify neutral JSON contains no required product UUIDs.
- Test that local quote execution performs no external calls.
- Test publication contracts for approval, effective time, immutability, and
  idempotency.
- Review this ADR when a new feature proposes crossing the ownership boundary.

## Links

- [Architecture overview](../../architecture.md)
- [Product scope](../../product-scope.md)
- [Methodology](../../methodology.md)
- [Optional Tanso adapter boundary](../../tanso-integration.md)
- [ADR-002: Injected React UI](ADR-002-injected-react-ui.md)
- [Golden scenarios](../../../fixtures/golden-scenarios/README.md)
