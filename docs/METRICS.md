# Metrics

Ramp's public Product Operations postings name "support tickets per active user and customer NPS" as a goal metric for the team (see [SOURCES.md](SOURCES.md), S6). Launch Control is built to move those two, through the leading indicators below. Every number in the product is computed from the synthetic seed; none is a claim about Ramp.

## North star

**Support tickets per active account in the 30 days after a launch**, compared with the 30 days before. A well-enabled launch should not raise it.

## Leading indicators (shown in the product)

| Metric | Definition | Seed value |
| --- | --- | --- |
| Agent routing rate | Items routed by the agent ÷ items received | 46 of 50 |
| Items needing a person | Below threshold or ambiguous between areas | 3 |
| Theme score | Distinct accounts × their ARR in $M | Top: 53.3 (SaaS declines, 7 accounts, $7.62M) |
| Launches cleared to GO | GO verdicts ÷ upcoming launches | 1 of 4 |
| Enablement on time | Enablement items done 2+ days before target | Shown per launch |
| Resolved within SLA | Resolved incidents within severity SLA | 9 of 10 |
| Median time to resolve | Per severity, with sample size; n under 3 is flagged as too few to compare | SEV-2: 9h |
| Reviews complete | Completed ÷ required post-incident reviews | 6 of 8 |
| Repeat incidents | Same area and root-cause category within 60 days | 2 |

## Guardrails

- **Wrong-area routes:** routes later overridden by a person to a different area. Target 0 on the held-out eval set; in production, watch the override rate weekly.
- **Abstain rate:** if the agent sends more than ~15% of items to a person, the keyword lists need work; if it sends 0%, the threshold is probably too low.
- **Stale sign-offs at decision time:** should be 0; the gate refuses them.

## Experiment (v2)

Hypothesis: launches that pass the full gate (enablement 2 days early, support macros done, no open SEV-1/2) see fewer tickets per active account in the 30 days after GA than launches that skip it. Compare gated and ungated launches over a quarter, controlling for launch size by accounts in the beta.
