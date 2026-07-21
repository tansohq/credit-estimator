# Credit Burndown Forecaster

Open-source, product-neutral credit usage forecasting for SaaS customer
dashboards.

A host supplies current balance, period allocation, complete daily usage, and
explicit low/base/high burn assumptions. The deterministic core projects
ending balance, utilization, depletion risk, and shortfall. The optional React
package renders the result inside the host's dashboard.

The estimator is read-only. It does not own wallets, ledgers, usage events,
entitlements, subscriptions, payments, or customer actions.

## Packages

| Package | Purpose |
|---|---|
| `@tansohq/credit-forecast-schema` | Provider-neutral Zod schemas and TypeScript contracts |
| `@tansohq/credit-forecast-core` | Browser-compatible deterministic calculations |
| `@tansohq/credit-burndown-react` | Controlled, accessible React components |
| `@tansohq/credit-forecast-json` | Deterministic JSON import and export |
| `@tansohq/credit-forecast-csv` | Portable multi-file CSV import and export |

These packages currently live in this pnpm workspace and are not published to
npm yet.

Packages are ESM-only. CommonJS hosts must use dynamic `import()`.

## Install the workspace

Requirements: Node.js 20 or later and Corepack.

```bash
git clone https://github.com/tansohq/credit-estimator.git
cd credit-estimator
corepack enable
pnpm install
```

## Calculate locally

```ts
import { forecastCreditUsage } from "@tansohq/credit-forecast-core";

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

## Embed the React UI

The host calculates or fetches the neutral result, then passes both snapshots
to the result-controlled component.

```tsx
import {
  CreditBurndown,
} from "@tansohq/credit-burndown-react";
import "@tansohq/credit-burndown-react/styles.css";

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

## JSON and CSV exchange

```ts
import {
  parseForecastInput,
  serializeForecastResult,
} from "@tansohq/credit-forecast-json";
import {
  exportForecastInputCsv,
  parseForecastResultCsv,
} from "@tansohq/credit-forecast-csv";
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

Tanso remains an optional future adapter. A hosted API, reference demo, runtime
wallet operations, and product-specific integrations are deferred.
