# ADR-002: Result-controlled React burndown UI

**Date:** 2026-07-21

**Status:** Accepted

**Deciders:** Project maintainers
**Review trigger:** A proposed UI feature adds forecast formulas, data fetching,
authentication, persistence, billing behavior, or a product-specific dependency

## Context and problem statement

The primary adoption path is an embeddable customer-facing credit burndown UI.
Companies should be able to place it in their dashboard so customers can see
current burn rate, projected depletion, remaining credits at period end, scenario
ranges, and the inputs behind the projection.

The embedding host may run the forecast core in the browser, run it on a
server, or obtain a compatible result through its own API. The component
package should not know which path produced the result. It should also avoid
owning product actions such as purchasing credits or changing a plan.

The architectural question is whether the React package should calculate or
fetch forecasts, or render versioned results controlled by its host.

## Decision drivers

- The core remains the only forecast formula implementation.
- Hosts retain control of data fetching, authentication, storage, and errors.
- Browser-local and server-produced results use the same components.
- Tanso and other products can embed the package without product-specific UI
  leaking into the generic contract.
- Components must be composable, accessible, responsive, themeable, and safe
  to import during server rendering.
- Charts must remain understandable without color, pointer interaction, or a
  visual display.
- Host applications control actions and product policy.

## Considered options

1. **API-bound UI:** The package fetches a forecast from a configured endpoint.
2. **Core-bound UI:** The package imports the forecast core and calculates on
   every input change.
3. **Result-controlled UI:** The host supplies neutral `ForecastInput` and
   `ForecastResult` objects; the package only renders them.
4. **Product-specific dashboards:** Each adopter builds its own forecast UI.

## Decision outcome

**Chosen option:** Result-controlled UI.

Publish the generic package as `@tanso-hq/credit-burndown-react`. React is a
peer dependency with initial support for `^18.2.0 || ^19.0.0`, limited to
majors exercised in CI.

The primary composition contract is:

```tsx
<CreditBurndown.Root input={input} result={result}>
  <CreditBurndown.Summary />
  <CreditBurndown.Chart />
  <CreditBurndown.Scenarios />
  <CreditBurndown.Warnings />
  <CreditBurndown.Breakdown />
</CreditBurndown.Root>
```

`ForecastInput` and `ForecastResult` are provider-neutral contracts exported
by `@tanso-hq/credit-forecast-schema`. The host supplies both objects. It may
calculate `result` locally through the canonical core entry point:

```ts
const result = forecastCreditUsage(input);
```

It may instead receive the same result from its own backend or a future
generic hosted API. That API is deferred and non-MVP. The React package does
not invoke the forecast calculation, call an endpoint, or coordinate an async
request.

The result is controlled state. New host props replace the rendered snapshot.
The UI does not mutate `input` or `result`, infer missing values, or recalculate
any field. If the host is loading, refreshing, or handling an error, it owns
that lifecycle and decides whether to retain the previous result or render its
own state around the components.

## Component responsibilities

- `Summary` presents balance, burn rate, projected depletion, and credits
  remaining at the forecast boundary.
- `Chart` presents observed usage and projected balance without inventing a
  historical balance the host did not supply.
- `Scenarios` compares low, base, and high outcomes.
- `Warnings` presents structured low-balance and depletion warnings from the
  result. Invalid input produces a validation failure before the UI receives a
  result.
- `Breakdown` explains assumptions and calculation steps already present in
  the result.

Components may format and arrange result values. They must not derive business
results that belong in the core.

## Required constraints

1. No forecast, burn-rate, depletion, balance, or scenario formula is
   implemented in the React package.
2. The package performs no network calls and contains no required endpoint,
   API client, authentication, persistence, wallet, ledger, entitlement,
   subscription, Stripe, or billing behavior.
3. `Root` receives matching provider-neutral `ForecastInput` and
   `ForecastResult` objects. Their `schemaVersion` and `methodologyVersion`
   values must be compatible before children render the result. The host
   replaces input and result atomically.
4. Input and result props are immutable. Components never mutate caller-owned
   objects.
5. The public API includes the compound components shown above and may provide
   an assembled convenience view built from the same primitives.
6. `Chart` always exposes equivalent data through an accessible table or text
   summary. It does not communicate a series, threshold, warning, or scenario
   through color alone.
7. Chart values reachable by pointer are also available to keyboard and
   assistive-technology users. Reduced-motion preferences are respected.
8. Components use semantic markup, visible focus, non-color status cues, and
   assistive-technology labels. Automated checks complement keyboard and
   screen-reader review.
9. The package is SSR-safe and does not access `window`, `document`, layout, or
   browser storage at module scope.
10. The stable styling boundary uses `--credit-burndown-*` CSS custom
    properties and `credit-burndown-*` class names, low-specificity selectors,
    and no global reset.
11. A typed `messages` contract covers all first-version user-visible strings
    and ships neutral English defaults. Message overrides do not change
    forecast semantics.
12. The layout works in narrow dashboard panels and does not assume a full
    page, application shell, CSS framework, or fixed container width.
13. Product-specific actions are provided through a typed host action slot.
    The package ships no built-in top-up, purchase, plan-change, or Tanso
    action.
14. Product names, credentials, SDK types, and product UUIDs do not appear in
    the generic component contract.
15. The UI can be installed and rendered with all adapter packages absent.

## Host action slot

The host may place an action beside the neutral summary without teaching the
component package what that action does:

```tsx
<CreditBurndown.Root
  input={input}
  result={result}
  actions={<ManageCreditsLink href="/billing/credits" />}
>
  {/* neutral components */}
</CreditBurndown.Root>
```

The slot is presentation composition only. The UI does not invoke purchases,
top-ups, wallet mutations, or plan changes.

## Positive consequences

- Embedding requires only neutral input and result objects.
- Hosts can choose local core execution or their own backend without forking
  components.
- The component package has no network, authentication, or product SDK
  dependency.
- Forecast formulas cannot drift between core and UI.
- Tanso-specific and other product-specific actions stay outside the generic
  package.
- Accessible non-chart representations are part of the contract, not a host
  afterthought.
- Small dependency and styling surfaces reduce integration conflicts.

## Negative consequences and mitigations

- **Hosts coordinate calculation:** The package does not provide a built-in
  request lifecycle. Mitigation: publish local-core and server-result examples
  in the reference application.
- **Input and result can become mismatched:** Controlled props may come from
  different snapshots, and version compatibility alone does not prove they
  match. Mitigation: hosts replace them atomically; test fixtures always pair a
  source input with its exact result.
- **Accessible charts require duplicate representation:** Tables and text add
  layout work. Mitigation: provide a shared accessible data-table primitive and
  test it with every chart fixture.
- **Product actions require composition:** Adopters must supply their own
  controls. Mitigation: provide one typed action slot without defining action
  behavior.

## Why the alternatives were rejected

### API-bound UI

It would impose transport, authentication, availability, and customer-data
policy on every adopter and prevent fully local usage.

### Core-bound UI

It would force every host to ship the calculation engine and would make
server-owned calculation an exception. Result control supports both without
duplicating formulas.

### Product-specific dashboards

They would duplicate forecast presentation, accessibility work, and result
interpretation across adopters.

## Compliance and verification

- Run package dependency checks before each React package release.
- In repository integration tests, calculate and render every valid golden
  input. Separately verify the UI package has no core or adapter dependency.
- Verify components do not calculate values absent from the result.
- Test atomic replacement of input and result props.
- Test every chart against its table or text equivalent.
- Run automated accessibility checks, keyboard flows, and screen-reader
  review for the assembled reference view.
- Test SSR-safe import without a DOM and rendering under each supported React
  major.
- Test default messages, complete overrides, narrow containers, reduced
  motion, CSS prefix stability, and host action composition.
- Verify no top-up or product action renders when the host supplies no action.
- Verify the package runs with all adapters absent and never invokes the core
  calculation internally.
- Review this ADR before adding formulas, data fetching, authentication,
  persistence, or a built-in product action.

## Links

- [Architecture overview](../../architecture.md)
- [Product scope](../../product-scope.md)
- [ADR-001: Provider-neutral forecast core](ADR-001-provider-neutral-core.md)
- [Methodology](../../methodology.md)
- [Optional Tanso adapter boundary](../../tanso-integration.md)
- [Golden scenarios](../../../fixtures/golden-scenarios/README.md)
