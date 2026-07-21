# ADR-002: Optional React UI with an injected estimator

**Date:** 2026-07-20

**Status:** Accepted

**Deciders:** Project maintainers
**Review trigger:** A proposed UI feature requires a specific estimator
transport, product SDK, persistence system, or duplicated calculation formula

## Context and problem statement

An embeddable calculator can make the estimator easier to adopt, but a UI that
directly calls one hosted API or imports a product adapter would undermine the
provider-neutral architecture. The same workflow needs to run entirely in a
browser, call a compatible hosted API, and embed inside Tanso or another
product.

The architectural question is how React components obtain estimates and
exports without owning calculation, transport, authentication, persistence,
or product integration.

## Decision drivers

- The deterministic engine remains the only formula implementation.
- Browser-local estimation must work without credentials or network access.
- A compatible hosted API must be substitutable without changing components.
- Embedding products must retain control of state, authentication, storage,
  branding, and product-specific actions.
- The generic package must remain testable without Tanso or an API server.
- Components should be composable, controlled, accessible, responsive, and
  themeable.

## Considered options

1. **API-bound component:** The UI includes a client for the estimator API and
   requires its endpoint and authentication model.
2. **Core-bound component:** The UI imports the calculation core and always
   executes it in the browser.
3. **Injected estimator:** The UI accepts a sync-or-async estimator function
   and a discoverable list of exporters supplied by its host.
4. **Product-specific UI:** Each adopting product implements a separate
   calculator against its own models and services.

## Decision outcome

**Chosen option:** Injected estimator.

`packages/ui-react` depends on neutral types from `packages/schema` and uses
React as a peer dependency. It does not require `packages/core`, `apps/api`, a
format adapter, a product adapter, or a network client. Its host injects:

```ts
type Estimate = (
  input: EstimatorInput,
  context: { signal: AbortSignal },
) => EstimatorResult | Promise<EstimatorResult>;
```

Estimation failures pass through a Zod-backed neutral error normalizer that
returns a stable code, message, retryability, and optional field issues.
Cancellation is detected from `signal.aborted`, not from a platform-specific
exception. The UI performs estimation only after explicit **Calculate**
submission and rejects stale completions by a monotonically increasing request
sequence. Editing while a request is active aborts and invalidates that
request without starting another one.

The host also owns controlled input state and injects zero or more
discoverable `Exporter` objects. A browser host can pass the pure core
function. A remote host can pass any API client that honors the neutral
schema. An adopting product can wrap the same components with its own
orchestration.

The package exposes an assembled calculator and compound components for
assumptions, metrics, scenarios, results, warnings, and traces. Tanso-specific
publication controls live in `packages/ui-tanso-react`, which consumes the
headless `packages/adapters/tanso` package, not in the generic calculator.

`apps/calculator` is a hosted demo and reference implementation. It may
demonstrate local execution, hosted API execution, and JSON/CSV exports, but
the UI package does not depend on that app.

## Required constraints

1. No calculation formula is implemented in `packages/ui-react` or
   `apps/calculator`.
2. The generic UI has no required endpoint, credentials, authentication,
   persistence, Stripe, wallet, ledger, or entitlement behavior.
3. Component inputs and results use versioned provider-neutral schemas and
   stable keys.
4. Public input state is controlled and immutable. Each edit supplies a new
   object; mutation in place is unsupported.
5. Both synchronous local and asynchronous remote estimators are supported.
6. Every call receives an `AbortSignal`; the UI rejects results whose request
   sequence, submitted input reference, or estimator reference is no longer
   current. Editing invalidates an in-flight call without starting a new one.
7. Editing never invokes estimation. The default and required first-version
   interaction is explicit **Calculate** submission.
8. Every rejection passes through the neutral Zod schema and normalizer;
   arbitrary values never reach rendering code.
9. JSON and CSV controls are created only from host-supplied `Exporter`
   objects; an absent or empty list renders no export actions.
10. `packages/adapters/tanso` is headless. Tanso React controls are separately
    installable from `packages/ui-tanso-react`.
11. CSS custom properties provide the public theming boundary; neutral styles
    do not assume a host framework.
12. Semantic markup, keyboard operation, focus management, assistive-technology
    announcements, non-color status cues, and responsive embedding are release
    requirements.
13. UI implementation begins after the core satisfies all golden scenarios.
14. The pure core entry point used in browsers has no Node-only runtime
    dependency and needs no Node.js polyfill.
15. Publish as `@tansohq/credit-calculator-react` with React peers initially
    `^18.2.0 || ^19.0.0`, limited to majors exercised in CI.
16. Imports are SSR-safe and do not access `window` or `document` at module
    scope.
17. Styles use stable semantic `--credit-calculator-*` custom properties,
    `credit-calculator-*` class names, low-specificity selectors, and no global
    reset.
18. A typed injectable `messages` contract provides an exhaustive
    first-version key set and neutral English defaults.
19. A Web Component is deferred until at least two committed non-React
    adopters cannot reasonably use the React package.

## Positive consequences

- One component contract supports offline, hosted, and embedded use.
- Consumers can replace transport or authentication without forking the UI.
- The UI is testable with a deterministic in-memory estimator.
- Core and API release concerns remain independent from component concerns.
- Product branding and actions can be added without contaminating neutral
  schemas or terminology.
- A small dependency surface improves portability and limits browser bundle
  cost.

## Negative consequences and mitigations

- **More host composition:** Consumers must provide estimation and export
  functions. Mitigation: publish reference local and remote composition
  examples in `apps/calculator`.
- **Sync and async lifecycle complexity:** The UI must handle loading, errors,
  cancellation, and out-of-order results. Mitigation: define neutral errors,
  pass an abort signal, and test sequence-based stale-result handling.
- **No built-in persistence:** A generic calculator cannot assume how drafts
  are stored. Mitigation: controlled state lets hosts add local, server, or
  product storage without changing the package.
- **Product actions need separate components:** Integration packages may
  duplicate some visual composition. Mitigation: reuse neutral primitives and
  share schema-based props without creating reverse adapter dependencies.

## Why the alternatives were rejected

### API-bound component

It would make offline use impossible, introduce transport and authentication
policy into the component package, and make the hosted estimator an
availability dependency.

### Core-bound component

It would support offline use but force every consumer to ship the calculation
engine and make remote execution an awkward special case. Host injection
allows local core use without making it a package dependency.

### Product-specific UI

It would fragment validation, terminology, accessibility, and result
presentation while increasing the risk that products reimplement formulas.

## Compliance and verification

- Add package dependency checks when `packages/ui-react` is created.
- Exercise golden scenario results through an injected local estimator.
- Use a contract test to prove local and remote estimator functions render
  equivalent versioned results.
- Test controlled state, explicit submission, loading and neutral error states,
  cancellation, and sequence-based stale async rejection after resubmission
  or editing.
- Test invalidation on external input replacement, estimator replacement,
  explicit reset, and unmount, plus normalization of native and arbitrary
  rejection values.
- Test that only configured exporters render and receive the matching input
  and result.
- Add automated accessibility checks and keyboard-flow tests.
- Test SSR-safe imports, supported React majors, message overrides, and the
  documented CSS prefix contract.
- Verify the calculator runs with Tanso packages absent.
- Verify the headless Tanso adapter runs with React packages absent.
- Review this ADR before adding any built-in API, authentication, storage, or
  product action to the generic UI.

## Links

- [Architecture overview](../../architecture.md)
- [Product scope](../../product-scope.md)
- [ADR-001: Provider-neutral core](ADR-001-provider-neutral-core.md)
- [Methodology](../../methodology.md)
- [Golden scenarios](../../../fixtures/golden-scenarios/README.md)
