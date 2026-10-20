# Five Whys: why do launches go wrong in the gaps between teams?

**Problem statement:** a feature ships, support is surprised, customers hit a known bug, and the same kind of incident happens again a month later.

1. **Why was support surprised?** The macros and training landed after the launch date.
2. **Why did enablement land late?** Nobody could see that it was late; the launch was tracked in the product team's tool and enablement in support's.
3. **Why was there no shared view?** Each team owns a different artefact (feedback in tickets and call notes, launches in a planning doc, incidents in an on-call tool) and nothing joins them.
4. **Why does that cause repeats?** Without the join, an open incident in the area doesn't stop a launch, and the root cause from the last incident never reaches the people deciding go/no-go.
5. **Why does the root cause get lost?** Reviews are optional in practice: no due date, no owner for the action items, and no signal when a new incident shares the same cause.

**Root cause:** there is no single place where customer evidence, launch gates and incident root causes are linked, with rules that refuse to pass on missing or stale evidence.

**What Launch Control does about each why:**

| Why | Response in the product |
| --- | --- |
| 1 | Support readiness is its own checklist section with critical items; GO requires them done |
| 2 | Enablement must be done 2 days before target, or the gate holds |
| 3 | Themes, launches and incidents link to each other and show on one overview chain |
| 4 | An open SEV-1/2 in the launch's area is a hard NO-GO blocker |
| 5 | Reviews have due dates, required whys and owned action items; repeats within 60 days are flagged |
