# Viability memo: the Product Operations Specialist seat

Written by Ayo Ahmed for the Product Operations Specialist role at Ramp. Independent concept, not affiliated with Ramp.

## The seat

Ramp's public postings for the role list voice of the customer, process development, product analysis, launch support, incident management and partner operations (SOURCES.md, S5), with launch ownership from Alpha to GA and a goal metric of support tickets per active user and customer NPS (S6). That is three jobs that usually live in three tools. The value of the seat is in joining them.

## Why this prototype is the right shape for it

- **Customer voice → product.** The person in this seat reads more raw feedback than anyone else. The useful output is not a tagged spreadsheet; it is a ranked, defensible list per area, with the ambiguous cases pulled out for a human. Launch Control's agent routes what it is sure of, explains every route, and refuses to rank a theme that only one account cares about.
- **Flawless launches.** The seat owns readiness, not the feature. A gate that fails closed (missing evidence, late enablement, stale sign-offs, an open SEV-2 in the area) protects the team from a "we'll fix it after GA" launch.
- **Incidents resolved fast, and once.** The seat runs the review, not the fix. Required whys, owned action items with due dates and a repeat flag turn reviews into a habit rather than a document.

## Is it viable as a real internal tool?

**Build cost:** small. The engine is about 1,200 lines of TypeScript with no external dependencies. The real work is integration: a feedback source (support desk, call notes, Slack), the launch tracker, and the incident tool. Each is one adapter behind a command API that already validates and deduplicates.

**Risks**

| Risk | Mitigation |
| --- | --- |
| Keyword routing does not scale to hundreds of themes | Keep the interface (score, rationale, runner-up, abstain) and swap the scorer for a model; keep the abstain rule and the held-out eval as the acceptance bar |
| Teams treat the gate as bureaucracy | Keep the checklist short (12 items), let owners mark done with one link, and only hard-block on what actually hurts customers |
| Reviews become box-ticking | Require at least three whys and one owned action; show repeats so the cost of a shallow review is visible |

## What I would do in the first 90 days

1. **Weeks 1–4:** shadow support and two area PMs; rebuild the theme list from a month of real tickets; measure how often feedback reaches the right owner today.
2. **Weeks 5–8:** run one launch through the gate end to end with support and enablement; track tickets per active account before and after.
3. **Weeks 9–12:** run reviews for every SEV-1 to SEV-3 for a month; report repeats and action-item completion to the product leads.

## Why me

I've done this job. I ran product operations at Corgi, then founded my own company and ran its operations end to end: intake, launches and the incidents that came after. This prototype is how I would think on day one.
