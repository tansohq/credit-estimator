# Contributing

## Before changing methodology

Open an issue before changing formulas, rounding, version semantics, or golden
fixtures. Explain the customer problem, proposed rule, compatibility impact,
and fixture changes. Published model behavior must remain deterministic and
reviewable.

Do not add wallet, ledger, billing, entitlement, authentication, persistence,
or product-specific behavior to the neutral packages. Put optional integration
behavior behind an adapter.

## Local setup

Requirements: Node.js 20 or later and Corepack.

```bash
corepack enable
pnpm install
pnpm typecheck
pnpm test:coverage
pnpm build
pnpm verify:packages
```

Every pull request must keep the golden scenarios passing. Add a focused
regression test for bug fixes. Do not silently default missing usage or
financial inputs.

## Pull requests

- Keep changes scoped and provider-neutral.
- Describe behavior changes and how they were verified.
- Update schemas, methodology, fixtures, and version documentation together
  when a contract changes.
- Do not commit credentials, customer data, generated packages, coverage, or
  local environment files.
- Do not commit generated `dist/` files.
