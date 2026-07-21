# Optional Tanso Adapter Boundary

## Purpose

Tanso is one optional source of credit and usage data. It is not required by
the forecast schemas, deterministic core, JSON contracts, or embeddable React
UI.

The boundary is:

    Tanso: authoritative balances, grants, deductions, usage, and billing state
    Tanso adapter: translate a read-only Tanso snapshot into neutral input
    Forecast core: calculate deterministic burndown projections
    React UI: render a host-supplied neutral forecast result

Removing the Tanso adapter must not affect local forecasting or the generic UI.

## Package and dependency direction

The optional headless adapter lives at:

    packages/adapters/tanso/

Permitted dependency direction:

    Tanso host -> Tanso adapter -> neutral forecast contract
    Tanso host -> forecast core
    Tanso host -> React UI

Forbidden dependency direction:

    forecast core / React UI -> Tanso adapter or Tanso SDK

The adapter may accept Tanso-specific source types at its outer boundary. It
returns only provider-neutral forecast input. The core and generic UI never
import the adapter, a Tanso SDK, a Tanso Java entity, a credential type, or a
Tanso identifier.

## Adapter responsibility

The headless adapter maps an already-fetched Tanso snapshot into
`ForecastInput`. The output supplies the same required fields as direct neutral
input:

- `asOf`, the first projected date;
- `period: { startDate, endDate, allocation, lowBalanceThreshold }`;
- current balance at the start of `asOf`, taken from Tanso's authoritative
  balance;
- complete daily usage history for `[period.startDate, asOf)`, including
  explicit zero-use days;
- explicit `lookbackDays`;
- explicit low, base, and high burn multipliers;
- explicit dated future balance deltas, when supplied by the host.

The source snapshot may include Tanso grants, deductions, reversals,
expiration, rollover, and usage records. The adapter maps usage deductions to
neutral daily usage only when the source meaning is explicit. It may map
scheduled grants or expirations to future balance deltas. It never derives the
current source-of-truth balance by replaying those records.

The adapter may:

- validate that required source fields are present;
- translate Tanso units and field names into neutral forecast fields;
- aggregate source records only where the neutral methodology defines the
  aggregation;
- reject ambiguous non-usage deductions instead of treating them as usage;
- map Tanso resources to stable host-defined keys;
- preserve display-only Tanso metadata in `extensions["com.tanso"]`; and
- return structured mapping errors for incomplete or incompatible snapshots.

The adapter must not:

- fetch data or acquire credentials;
- call Tanso from the forecast core or React UI;
- change Tanso balances, grants, deductions, or usage records;
- create a wallet, transaction, subscription, payment, or top-up;
- persist a forecast or runtime metric event;
- change product configuration;
- infer missing forecast or usage inputs silently;
- implement forecast formulas that belong in the core; or
- make Tanso availability a dependency after the host has assembled a local
  snapshot.

The embedding host owns authentication, Tanso API calls, retries, caching,
refresh behavior, and error presentation. A separately configured host client
may fetch the source snapshot, but it is not part of the neutral forecast core
or generic React package.

## Neutral contract

The adapter output is the same `ForecastInput` accepted from any other source.
It includes:

- `schemaVersion`;
- `methodologyVersion`;
- ISO 8601 date-only period and observation values (`YYYY-MM-DD`);
- the explicit balance and usage snapshot required by the methodology;
- explicit low, base, and high scenario assumptions; and
- optional namespaced extensions that do not change neutral calculations.

Portable JSON encodes decimal quantities as canonical base-10 strings. Count
fields such as `lookbackDays` remain JSON integers. The adapter must not emit
binary floating-point values for usage, balances, deltas, rates, or
multipliers.

The resulting `ForecastResult` echoes `schemaVersion` and
`methodologyVersion`. It contains no generated timestamp. If a Tanso host
wants to show when it fetched the source data, that retrieval time stays in
host presentation state outside the deterministic payload.

Neutral schemas require no Tanso UUID. A host may maintain a lookup from its
stable keys to Tanso resources. Tanso identifiers needed for display or
diagnostics may remain outside the neutral payload or appear under the Tanso
extension namespace:

```json
{
  "extensions": {
    "com.tanso": {
      "sourceRef": "adapter-managed-reference"
    }
  }
}
```

The core ignores unknown extensions. Any value that changes a forecast must
be represented by a documented neutral field.

## Data flow

```text
Tanso APIs or local Tanso state
        |
        | host fetches and authorizes
        v
Read-only Tanso snapshot
        |
        | packages/adapters/tanso maps
        v
Neutral ForecastInput
        |
        | packages/core forecasts locally
        v
Neutral ForecastResult
        |
        | host passes controlled props
        v
@tansohq/credit-burndown-react
```

The host can perform all steps in its backend, in its frontend when safe, or
across both. The neutral contracts remain the boundary.

## Tanso authority

Tanso remains authoritative for Tanso-managed runtime state:

- current balances and credit pools;
- grant and deduction history;
- wallet ordering and expiration behavior;
- metered usage records;
- subscription state;
- billing and payments; and
- top-up completion.

The forecast is a projection from a supplied snapshot. It does not reserve
credits, guarantee future usage, alter entitlement decisions, reconcile the
ledger, or override Tanso state.

If the forecast and current Tanso state differ, the host refreshes the source
snapshot and recalculates. The forecast result never writes corrections back
to Tanso.

## Generic UI integration

Tanso embeds the same result-controlled React components as any other adopter:

```tsx
<CreditBurndown.Root input={input} result={result}>
  <CreditBurndown.Summary />
  <CreditBurndown.Chart />
  <CreditBurndown.Scenarios />
  <CreditBurndown.Warnings />
  <CreditBurndown.Breakdown />
</CreditBurndown.Root>
```

The generic UI has no Tanso behavior. Tanso may supply a product-specific
link or control through the host action slot, but the package provides no
built-in top-up, wallet, billing, or plan-change action. Tanso controls own
their authentication, side effects, confirmation, and error handling outside
the neutral component package.

## Integration verification

- Run adapter mapping tests from recorded or synthetic Tanso snapshots without
  network access.
- Assert neutral output requires no Tanso UUID.
- Assert adapter output validates against the same `ForecastInput` schema used
  by non-Tanso hosts.
- Run the same golden forecast through direct neutral input and mapped Tanso
  input and compare results.
- Verify source records and caller-owned objects are not mutated.
- Verify mapping failures are structured and do not silently drop
  calculation-relevant data.
- Verify the core and React packages install and run with the Tanso adapter
  absent.
- Verify the adapter package imports neither React nor the UI package.
- Verify no integration path writes balances, creates top-ups, or changes
  product configuration.

See [architecture.md](architecture.md) for package boundaries,
[ADR-001](architecture/decisions/ADR-001-provider-neutral-core.md) for the
forecast-core decision, and
[ADR-002](architecture/decisions/ADR-002-injected-react-ui.md) for the React UI
boundary.
