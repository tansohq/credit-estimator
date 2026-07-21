# Credit Estimation Methodology

## Purpose

This document defines the calculation methodology that should first be
validated in a spreadsheet and then implemented as a pure calculation engine.

The methodology connects:

    customer variables
      -> forecast metric volumes
      -> metric economics
      -> credit weights
      -> expected credit demand
      -> provider cost and customer revenue
      -> margin and plan recommendations

Every derived value must be auditable from explicit inputs.

## Required units

Every input must declare or imply:

- currency, using an ISO 4217 code;
- forecast period, initially monthly;
- provider token rates, expressed per million tokens;
- workload frequency, expressed per seat per day or directly per month;
- metric unit, such as completed research task or generated document; and
- credit increment, such as 1 or 0.1 credits.

Do not mix annual customer value with monthly usage until both are converted
to the same period.

## Global assumptions

At minimum, a model defines:

- realized price per credit;
- target gross margin;
- target customer-value capture rate;
- maximum customer-value capture rate;
- credit rounding increment;
- plan allocation buffer;
- currency; and
- methodology version.

Realized price per credit is:

    package price / package credits

For a subscription plan it may be:

    (plan price - fixed platform fee) / included credits

## Metric unit cost

Each metric represents a completed, billable product action.

AI provider cost is:

    input tokens / 1,000,000 * input rate per million
      + output tokens / 1,000,000 * output rate per million

Total unit cost is:

    AI provider cost
      + infrastructure cost
      + third-party API cost
      + other variable cost

Labor that does not vary with each completed action should not be treated as a
unit cost unless the model explicitly allocates it.

## Customer value

Customer value per metric unit may be estimated from:

    revenue enhancement
      + labor or operating cost savings
      + probability-weighted loss avoided
      + operating-capital benefit
      + capital-investment deferral
      + option or strategic value
      - unique customer costs
      - expected shortfall

Probability-weighted risk reduction is:

    loss amount * probability before
      - loss amount * probability after

If value is estimated annually, value per action is:

    annual value / expected annual completed actions

Confidence-adjusted value is:

    estimated value per action * evidence confidence

Confidence is an explicit input between zero and one. Suggested evidence
bands are:

- 0.30 for an unsupported internal assumption;
- 0.60 for customer research or a credible external benchmark; and
- 0.90 for measured customer results.

These bands are defaults, not universal truth.

## Credit-weight guardrails

Minimum credits required to meet margin are:

    ceil_to_increment(
      unit cost
      / (realized price per credit * (1 - target gross margin))
    )

Value-supported credits are:

    round_to_increment(
      confidence-adjusted value
      * target value-capture rate
      / realized price per credit
    )

Maximum value credits are:

    floor_to_increment(
      confidence-adjusted value
      * maximum value-capture rate
      / realized price per credit
    )

Recommended credits per metric unit are initially:

    max(minimum cost credits, value-supported credits)

A metric is economically infeasible when:

    minimum cost credits > maximum value credits

An infeasible metric must remain visible in the result. The engine must not
silently lower its cost, raise its value, or hide the warning.

Unit revenue is:

    recommended credits * realized price per credit

Expected unit gross margin is:

    (unit revenue - unit cost) / unit revenue

If unit revenue is zero, gross margin should be returned as zero or null
according to the output schema, never as an arithmetic error.

## Customer workload forecast

For a driver-based forecast, monthly metric volume is:

    accounts
      * seats per account
      * active-seat percentage
      * actions per active seat per active day
      * active days per month
      * adoption percentage
      * completion percentage

A direct monthly-volume input may be supported when the driver components are
not available. The output should retain which forecasting method was used.

Start with the few variables that materially affect consumption. Do not add a
large customer questionnaire until design partners demonstrate that it
improves decisions.

## Scenario analysis

The initial model supports low, base, and high scenarios. Scenario
multipliers are explicit inputs for:

- metric volume;
- token volume or unit cost; and
- provider price.

For each scenario:

    monthly credits
      = sum(monthly metric volume * credits per metric unit)

    monthly provider cost
      = sum(monthly metric volume * unit cost)

    consumption revenue
      = monthly credits * realized price per credit

    gross profit
      = consumption revenue - monthly provider cost

    gross margin
      = gross profit / consumption revenue

If scenario multipliers are ordered low, base, and high, corresponding demand
outputs should also remain ordered unless an explicit nonlinear rule explains
otherwise.

## Plan allocation

A simple starting recommendation is:

    base monthly credits * (1 + allocation buffer)

The result may round this amount to a customer-friendly package increment.

Plan analysis should report:

- expected utilization;
- high-scenario utilization;
- effective price per consumed credit;
- expected provider cost;
- expected gross margin;
- probability or scenario of requiring a top-up; and
- expected unused credits.

Do not rely on unused-credit breakage to make otherwise unprofitable unit
economics appear healthy.

## Calculation trace

Every recommended metric weight should include:

- source inputs;
- calculated unit cost;
- confidence-adjusted customer value;
- cost-floor credits;
- value-supported credits;
- maximum value credits;
- recommended credits;
- expected unit revenue;
- expected unit margin;
- feasibility status; and
- warnings.

## Worked examples

### Simple summarization

Given:

- unit cost: 0.002 USD;
- confidence-adjusted customer value: 0.20 USD;
- realized price per credit: 0.01 USD;
- target gross margin: 70 percent;
- target value capture: 5 percent; and
- maximum value capture: 10 percent.

The cost floor is one credit, the value-supported weight is one credit, and
the maximum value weight is two credits. The recommendation is one credit.

### Deep research

Given:

- unit cost: 0.02 USD;
- confidence-adjusted customer value: 4.00 USD;
- realized price per credit: 0.01 USD;
- target gross margin: 70 percent;
- target value capture: 5 percent; and
- maximum value capture: 10 percent.

The cost floor is seven credits, the value-supported weight is twenty
credits, and the maximum value weight is forty credits. The recommendation is
twenty credits. Unit revenue is 0.20 USD and expected unit gross margin is 90
percent.

## Calibration

When production telemetry becomes available, compare:

- forecast volume with actual volume;
- estimated unit cost with actual unit cost;
- expected credits with actual credit burn;
- expected margin with actual margin; and
- expected plan utilization with actual utilization.

Recommended initial quality measures include weighted absolute percentage
error, margin variance, package utilization, top-up frequency, and hard-limit
denial rate.

Automatic recalibration is not part of the MVP. The first feedback loop may
be a manual report.
