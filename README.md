# Credit Burndown Forecaster

An embeddable, provider-neutral component that forecasts credit or usage
runway from observed host data.

A host supplies current balance, period allocation, complete daily usage, and
explicit low/base/high burn assumptions. The deterministic core projects
ending balance, utilization, depletion risk, and shortfall. The optional React
package renders the result inside the host's dashboard.

The estimator is read-only. It does not own wallets, ledgers, usage events,
entitlements, subscriptions, payments, or customer actions.

## Delivery model

Implemented paths:

1. **Standalone library:** run the deterministic core in a browser or Node.js.
   The local demo shows browser-only integration.
2. **Result-controlled React widget:** calculate in the host, then pass neutral
   input and result objects into the component package.
3. **Optional Tanso snapshot adapter:** map an already-fetched,
   already-consistent Tanso forecast snapshot plus explicit assumptions into
   validated neutral input.

No CLI, hosted forecast API, or automatic Tanso source connector ships in the
MVP.

## Packages

| Package | Purpose |
|---|---|
| `@tanso-hq/credit-forecast-schema` | Provider-neutral Zod schemas and TypeScript contracts |
| `@tanso-hq/credit-forecast-core` | Browser-compatible deterministic calculations |
| `@tanso-hq/credit-burndown-react` | Controlled, accessible React components |
| `@tanso-hq/credit-forecast-json` | Deterministic JSON import and export |
| `@tanso-hq/credit-forecast-csv` | Portable multi-file CSV import and export |
| `@tanso-hq/credit-forecast-tanso` | Pure optional Tanso snapshot-to-neutral mapping |

All six packages are published to npm under the `@tanso-hq` scope at version
`0.1.0`. Install only what you need, for example:

```bash
npm install @tanso-hq/credit-forecast-core @tanso-hq/credit-burndown-react
```

Packages are ESM-only. CommonJS hosts must use dynamic `import()`.

## Install the workspace

Requirements: Node.js 20 or later and Corepack.

```bash
git clone https://github.com/tansohq/credit-estimator.git
cd credit-estimator
corepack enable
pnpm install
```

## Run the standalone library

```ts
import { forecastCreditUsage } from "@tanso-hq/credit-forecast-core";

const result = forecastCreditUsage({
  schemaVersion: "1.0",
  methodologyVersion: "1.0",
  asOf: "2026-01-03",
  period: {
    startDate: "2026-01-01",
    endDate: "2026-01-06",
    allocation: "500",
    lowBalanceThreshold: "50",
  },
  lookbackDays: 2,
  dailyUsage: [
    { date: "2026-01-01", creditsUsed: "40" },
    { date: "2026-01-02", creditsUsed: "60" },
  ],
  balance: { current: "400", schedule: [] },
  scenarios: [
    { key: "low", burnMultiplier: "0.75" },
    { key: "base", burnMultiplier: "1" },
    { key: "high", burnMultiplier: "1.5" },
  ],
});
```

All credit values are canonical decimal strings. `asOf` is explicit. The core
does not read the clock, filesystem, network, credentials, or product state.

Invalid input throws a structured `ForecastValidationError` with a portable
failure envelope.

## Run the reference app

```bash
pnpm demo
```

Open the local URL printed by Vite. The app calculates entirely in the browser
and demonstrates explicit submission, scenario presets, warnings, calculation
traces, and host-owned JSON export.

## Embed the React UI

The host calculates the neutral result in its browser or Node.js process, then
passes both objects to the result-controlled component. A host may instead
calculate on its own backend and pass the same result to its frontend.

```tsx
import { forecastCreditUsage } from "@tanso-hq/credit-forecast-core";
import { CreditBurndown } from "@tanso-hq/credit-burndown-react";
import "@tanso-hq/credit-burndown-react/styles.css";

const result = forecastCreditUsage(input);

<CreditBurndown.Root input={input} result={result}>
  <CreditBurndown.Summary />
  <CreditBurndown.Chart />
  <CreditBurndown.Scenarios />
  <CreditBurndown.Warnings />
  <CreditBurndown.Breakdown />
</CreditBurndown.Root>;
```

The package has no fetch, authentication, persistence, billing, or Tanso
dependency. Hosts can inject actions, override typed messages, control the
selected scenario, and theme semantic `--credit-burndown-*` CSS variables.
React peers are `^18.2 || ^19`.

## Optional Tanso integration

`@tanso-hq/credit-forecast-tanso` maps two host-supplied objects into the same
validated `ForecastInput` used by every other host. Within this workspace:

```ts
import { forecastCreditUsage } from "@tanso-hq/credit-forecast-core";
import {
  mapTansoSnapshotToForecastInput,
  type TansoForecastAssumptions,
  type TansoForecastSnapshot,
} from "@tanso-hq/credit-forecast-tanso";

const snapshot: TansoForecastSnapshot = {
  sourceSchemaVersion: "1.0",
  asOf: "2026-01-03",
  currentBalance: "400",
  dailyUsage: [
    { date: "2026-01-01", creditsUsed: "40" },
    { date: "2026-01-02", creditsUsed: "60" },
  ],
};

const assumptions: TansoForecastAssumptions = {
  schemaVersion: "1.0",
  methodologyVersion: "1.0",
  period: {
    startDate: "2026-01-01",
    endDate: "2026-01-06",
    allocation: "500",
    lowBalanceThreshold: "50",
  },
  lookbackDays: 2,
  scheduledBalanceDeltas: [],
  scenarioMultipliers: { low: "0.75", base: "1", high: "1.5" },
};

const input = mapTansoSnapshotToForecastInput(snapshot, assumptions);
const result = forecastCreditUsage(input);
```

The mapping function is exactly:

```ts
function mapTansoSnapshotToForecastInput(
  snapshot: TansoForecastSnapshot,
  assumptions: TansoForecastAssumptions,
): ForecastInput;
```

It performs no fetch, authentication, aggregation, inference, sorting,
zero-filling, defaulting, balance reconstruction, SDK call, or forecast
calculation. Missing or inconsistent data throws `TansoMappingError`; its
`toJSON()` method returns `{ code: "TANSO_MAPPING_FAILED", issues }`.
Runtime validation still protects JavaScript callers and TypeScript callers
that pass untrusted values through a cast.

The host must fetch and assemble the snapshot. Never derive daily usage by
parsing generic transactions, descriptions, labels, or deduction amounts.
Tanso credentials, API calls, identifiers, wallet state, and actions remain
outside the adapter, core, and React packages. See the
[optional Tanso boundary](docs/tanso-integration.md).

## JSON and CSV exchange

```ts
import {
  parseForecastInput,
  serializeForecastResult,
} from "@tanso-hq/credit-forecast-json";
import {
  exportForecastInputCsv,
  parseForecastResultCsv,
} from "@tanso-hq/credit-forecast-csv";
```

The JSON adapter emits stable, key-sorted JSON. The CSV adapter uses an
RFC 4180 bundle so nested input, projected points, warnings, and traces remain
lossless. Both adapters validate imported and exported data against the neutral
schemas.

## Methodology

The calculation uses complete observed daily buckets in
`[period.startDate, asOf)`. It averages the explicit lookback window, applies
the low/base/high burn multipliers, and projects one balance point per date in
`[asOf, period.endDate)`. Scheduled balance changes apply before that day's
burn. Decimal results round half-up to at most 12 fractional digits after each
named calculation.

Every successful result includes the input versions, observed and projected
series, depletion status, structured warnings, and ordered calculation traces.
See [the full methodology](docs/methodology.md) and
[golden scenarios](fixtures/golden-scenarios/README.md).

## Verify

```bash
pnpm test
pnpm test:coverage
pnpm typecheck
pnpm build
pnpm verify:packages
```

CI runs the same checks on Node.js 20. Core acceptance tests load every JSON
fixture under `fixtures/golden-scenarios/`. UI tests cover accessibility,
controlled composition, chart table equivalents, and SSR-safe rendering.

## Boundaries and roadmap

- [Product scope](docs/product-scope.md)
- [Architecture](docs/architecture.md)
- [Optional Tanso integration](docs/tanso-integration.md)
- [Provider-neutral core ADR](docs/architecture/decisions/ADR-001-provider-neutral-core.md)
- [Result-controlled React UI ADR](docs/architecture/decisions/ADR-002-injected-react-ui.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

Tanso remains an optional edge adapter. Its automatic source connector, a
hosted API, runtime wallet operations, and other product-specific integrations
are deferred.
