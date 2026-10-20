# v2 roadmap

Ordered by what I expect to move tickets per active account and NPS soonest.

## Now (next 4–6 weeks)

1. **Real feedback sources.** Adapters for a support desk export, call-note summaries and a shared Slack channel, all going through the existing all-or-nothing import and dedupe.
2. **Model-assisted triage behind the same interface.** Keep score, rationale, runner-up and abstain. Ship only if it beats the deterministic agent on the held-out set with zero wrong-area routes, and keep the deterministic agent as the fallback.
3. **Post-launch measurement.** Pull tickets per active account for 30 days either side of GA, per launch, onto the launch page.

## Next (quarter)

4. **Roles and audit trail.** Sign-offs tied to real identities; only the named owner can sign their role.
5. **Notifications.** Slack messages when a gate changes state, a review goes overdue or a repeat is detected.
6. **Theme lifecycle.** Merge and split themes, and track a theme from "first seen" to "shipped" to "complaints stopped".
7. **Status-page drafts** from incident updates, reviewed by a person before publishing.

## Later

8. **Partner operations** board (card networks, bank partners, travel suppliers) with partner-caused incidents linked to their SLAs.
9. **Launch calendar** across areas to spot support-capacity collisions.
10. **Quarterly voice-of-customer report** generated from the theme history, for product planning.

## Explicitly not planned

- Replacing the incident-response tool. Launch Control links to it and owns the review, not paging.
- Auto-routing without an abstain path.
