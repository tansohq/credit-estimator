# Golden Scenarios

These fixtures are executable product requirements for the estimator.

Each file contains:

- a fixture-level `schemaVersion`, `methodologyVersion`, and `modelVersion`;
- the assumptions and metric inputs;
- the same three explicit versions in the calculation input;
- an expected output envelope that asserts all three versions unchanged;
- expected calculated values; and
- behavioral assertions.

The repetition is intentional. A fixture runner must reject a fixture when
the fixture metadata, calculation input, and expected output versions differ.
A draft `modelVersion` labels the assumption snapshot under test; it does not
imply that the model is approved or published.
Fixture `modelVersion` values are unique across the suite; reuse for different
calculation-relevant inputs is invalid.

The initial engine should load every fixture and verify the expected result
without network access. Currency calculations should use decimal-safe
arithmetic.

The fixtures cover:

- a one-credit summarization action;
- a value-supported deep-research action;
- provider and total unit cost from explicit cost components;
- confidence-adjusted value from estimated value and evidence confidence;
- monthly volume from customer/workload drivers;
- an economically infeasible action;
- zero monthly usage;
- ordered low/base/high scenarios;
- plan allocation with an explicit buffer;
- a structured calculation trace;
- deterministic repeated execution; and
- provider-independent offline execution.

Direct and decomposed economic inputs are deliberately covered separately.
All fixtures include the required `planAllocationBuffer`, even when the
scenario does not request a plan recommendation, so validation never depends
on a hidden financial default.
