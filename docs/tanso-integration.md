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

The pure mapping package `@tanso-hq/credit-forecast-tanso` is implemented. It
maps a host-supplied `TansoForecastSnapshot` plus explicit
`TansoForecastAssumptions` into validated neutral `ForecastInput`.

An automatic Tanso source connector is not implemented. The mapping package
does not fetch or assemble a live snapshot.

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

## Adapter responsibility and public contract

```ts
interface TansoForecastSnapshot {
  readonly sourceSchemaVersion: "1.0";
  readonly asOf: ISODate;
  readonly currentBalance: DecimalString;
  readonly dailyUsage: readonly {
    readonly date: ISODate;
    readonly creditsUsed: DecimalString;
  }[];
}

interface TansoForecastAssumptions {
  readonly schemaVersion: string;
  readonly methodologyVersion: string;
  readonly period: {
    readonly startDate: ISODate;
    readonly endDate: ISODate;
    readonly allocation: DecimalString;
    readonly lowBalanceThreshold: DecimalString;
  };
  readonly lookbackDays: number;
  readonly scheduledBalanceDeltas: readonly {
    readonly date: ISODate;
    readonly creditDelta: DecimalString;
    readonly reason?: string;
  }[];
  readonly scenarioMultipliers: {
    readonly low: DecimalString;
    readonly base: DecimalString;
    readonly high: DecimalString;
  };
}

interface TansoMappingIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

interface TansoMappingFailure {
  readonly code: "TANSO_MAPPING_FAILED";
  readonly issues: readonly TansoMappingIssue[];
}

class TansoMappingError extends Error {
  readonly code: "TANSO_MAPPING_FAILED";
  readonly issues: readonly TansoMappingIssue[];
  toJSON(): TansoMappingFailure;
}

function mapTansoSnapshotToForecastInput(
  snapshot: TansoForecastSnapshot,
  assumptions: TansoForecastAssumptions,
): ForecastInput;
```

The host supplies `sourceSchemaVersion: "1.0"`, `asOf`, current balance at the
start of `asOf`, and complete ordered daily usage. It also supplies explicit
schema and methodology versions, period boundaries, allocation, threshold,
lookback, scheduled balance deltas, and low/base/high multipliers. The schedule
must be present as `[]` when no deltas exist.

The function returns fully validated `ForecastInput` or throws
`TansoMappingError`. It never returns a partial value. Runtime validation still
produces the structured error for untrusted JavaScript values or values passed
through TypeScript casts.

The adapter must not:

- fetch data or acquire credentials;
- call a Tanso API or SDK;
- aggregate, infer, or classify source records;
- sort usage buckets or scheduled deltas;
- zero-fill missing days or default any input;
- reconstruct the current balance;
- call Tanso from the forecast core or React UI;
- change Tanso balances, grants, deductions, or usage records;
- create a wallet, transaction, subscription, payment, or top-up;
- persist a forecast or runtime metric event;
- change product configuration;
- infer usage from generic credit transactions, transaction descriptions,
  labels, or deduction amounts;
- implement forecast formulas that belong in the core;
- emit Tanso UUIDs or namespaced extensions; or
- make Tanso availability a dependency after the host has assembled a local
  snapshot.

The embedding host owns event collection, source-of-truth classification,
authentication, Tanso API calls, retries, caching, refresh behavior, and error
presentation. A separately configured host client may fetch the source
snapshot, but it is not part of the neutral forecast core or generic React
package.

## Neutral contract

The adapter output is the same `ForecastInput` accepted from any other source.
It includes:

- `schemaVersion`;
- `methodologyVersion`;
- ISO 8601 date-only period and observation values (`YYYY-MM-DD`);
- the explicit balance and usage snapshot required by the methodology;
- explicit low, base, and high scenario assumptions.

Portable JSON encodes decimal quantities as canonical base-10 strings. Count
fields such as `lookbackDays` remain JSON integers. The adapter must not emit
binary floating-point values for usage, balances, deltas, rates, or
multipliers.

The resulting `ForecastResult` echoes `schemaVersion` and
`methodologyVersion`. It contains no generated timestamp. If a Tanso host
wants to show when it fetched the source data, that retrieval time stays in
host presentation state outside the deterministic payload.

Neutral schemas require no Tanso UUID. The implemented adapter emits neither
Tanso identifiers nor extensions. Host-only identifiers remain outside the
deterministic payload.

## Why source retrieval is separate

The mapping boundary is intentionally narrower than a live Tanso connector:

- a live Tanso balance is request-time state, not necessarily the balance at
  the start of the requested `asOf` date;
- allocation periods and amounts can be ambiguous, especially for historical
  forecasts; and
- the current public SDK does not expose a trustworthy, complete daily
  credit-use snapshot for the required observed interval.

The repository therefore does not claim a source endpoint exists. A host must
assemble and verify these inputs from its own authoritative context. Parsing
generic transactions, descriptions, labels, or deduction amounts is not a
supported substitute.

## Data flow

```text
Host-owned Tanso source integration (not included)
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
@tanso-hq/credit-burndown-react
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

The implemented adapter is verified to:

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
- Verify core and React dependency manifests and package contents contain no
  Tanso adapter dependency.
- Verify the adapter package imports neither React nor the UI package.
- Verify no integration path writes balances, creates top-ups, or changes
  product configuration.

See [architecture.md](architecture.md) for package boundaries,
[ADR-001](architecture/decisions/ADR-001-provider-neutral-core.md) for the
forecast-core decision, and
[ADR-002](architecture/decisions/ADR-002-injected-react-ui.md) for the React UI
boundary.
