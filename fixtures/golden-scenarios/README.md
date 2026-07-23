# Golden Scenarios

These fixtures are executable acceptance criteria for the deterministic
customer-facing credit usage and burndown forecaster.

Every fixture contains:

- fixture-level `schemaVersion` and `methodologyVersion`;
- the same versions in `input`;
- explicit date-only period boundaries and `asOf`;
- complete observed daily history for `[period.startDate, asOf)` unless the
  fixture intentionally tests validation;
- an explicit lookback, balance, future schedule, and ordered low/base/high
  scenarios; and
- an `expected` output subset or `expectedError` subset.

A fixture runner must recursively compare each expected subset with the actual
result. Fields omitted from `expected` are not optional output fields; they are
simply outside that fixture's assertion focus. Every successful calculation is
still required to return the complete methodology-defined output, including
all projected points and calculation traces.

Fixture metadata, input, and result versions must match. There is no
`modelVersion` in this contract.

Portable JSON represents all credit amounts, balances, multipliers,
utilization values, and decimal trace operands/results as canonical base-10
strings. Integer counts such as `lookbackDays`, `daysRemaining`, and
`repeatCount` remain JSON integers.

The suite covers:

- steady on-track burn;
- exact and negative depletion;
- zero observed and projected usage;
- low-balance threshold equality;
- a scheduled positive balance delta that restores balance after depletion;
- simultaneous depletion and low-ending-balance warnings after recovery;
- a scheduled expiration before daily burn;
- changing observed usage, a short lookback, and scenario ordering;
- repeating-decimal rounding at the methodology precision boundary;
- observed cumulative points, projected chart points, and ordered traces;
- deterministic repeated offline execution; and
- rejection of incomplete daily history.

Implementations must load every fixture and verify it without network access,
credentials, the system clock, or binary floating-point arithmetic.
