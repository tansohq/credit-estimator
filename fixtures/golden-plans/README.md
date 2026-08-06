# Golden Plans

These fixtures are executable acceptance criteria for the deterministic
buyer-facing credit planning calculator defined in
`docs/planning-methodology.md`.

Every fixture contains:

- fixture-level `schemaVersion` and `methodologyVersion`;
- the same versions in `input`;
- explicit date-only plan period boundaries;
- a non-empty metric-estimate list with host-supplied credit weights,
  unless the fixture intentionally tests validation;
- ordered low/base/high scenarios and an optional candidate allocation; and
- an `expected` output subset or `expectedError` subset.

A fixture runner must recursively compare each expected subset with the
actual result. Fields omitted from `expected` are not optional output
fields; they are simply outside that fixture's assertion focus. Every
successful calculation is still required to return the complete
methodology-defined output, including metric breakdowns and calculation
traces.

Fixture metadata, input, and result versions must match. There is no
`modelVersion` in this contract.

Portable JSON represents all unit counts, credit weights, credit amounts,
multipliers, utilization values, and decimal trace operands/results as
canonical base-10 strings. Integer counts such as `daysInPeriod` remain
JSON integers.

The suite covers:

- a multi-metric project plan within its candidate allocation;
- the monthly worked example from the methodology, including an
  over-allocation scenario, shortfall, and warning;
- an estimate-only plan with no candidate allocation and null comparisons;
- zero estimated units and zero credit weights;
- repeating-decimal rounding at the methodology precision boundary with
  trace assertions;
- widely spread multipliers preserving low/base/high ordering; and
- rejection of duplicate metric keys, unordered scenario multipliers, and
  negative estimated units.

Implementations must load every fixture and verify it without network
access, credentials, the system clock, or binary floating-point
arithmetic.
