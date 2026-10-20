# PRD: Ramp Launch Control

Independent concept by Ayo Ahmed. Not affiliated with Ramp. All data is synthetic.

## Problem

Product Operations sits between customers, product, support and engineering. Launches fail in the gaps between those teams: customer feedback gets lost in tickets and call notes, enablement lands after the launch it was meant to support, and incidents repeat because the root cause never makes it into a review. Each team has its own tool, so nobody sees the chain from "customers are asking for this" to "we shipped it" to "it broke, here is why".

## Users

| User | Needs |
| --- | --- |
| Product Operations Specialist (primary) | One place to triage feedback, run launch gates and drive incidents to a reviewed close |
| Product manager for an area | A ranked, evidence-backed list of what their customers are asking for |
| Support and CX lead | To know a launch is coming, with macros and training ready before it ships |
| Engineering lead | A clear severity, owner and SLA during an incident, and a review that ends in owned action items |

## Scope (v1)

### 1. Customer Voice

- Seeded with 50 synthetic feedback items from 32 accounts across Cards, Expenses, Bill Pay and Travel, arriving through support tickets, CSM and sales calls, in-app feedback, NPS comments and shared Slack channels.
- A triage agent assigns each item to one of 12 themes and routes it to the owning product area, with a written rationale: matched phrases, score, the winning theme and owner, and the runner-up it beat.
- The agent does not guess. It sends an item to a person when the score is under the routing threshold (3) or when two areas are within 2 points of each other. It rejects text too short to read.
- Themes are scored as **distinct accounts × their ARR in $M** (frequency × revenue impact). A theme needs at least 3 distinct accounts to be ranked, so one loud account cannot outrank a pattern; below that it stays on watch.
- A person can override any route with a note; the override is shown as "routed by a person" and can be returned to the agent.
- Themes can be handed off to the owning area. The handoff records how many items it covered and flags new items that arrive afterwards.
- CSV import with all-or-nothing validation: exact header, unique IDs, valid timestamps (no future, max one year old), known channel and segment, max 200 rows. One bad row rejects the file, with every error listed.

### 2. Launch Readiness

- Four upcoming launches, each with a checklist across enablement docs, support readiness, quality, customer comms and measurement, plus four sign-offs (Product, Engineering, Support, Product Ops).
- Seeded states: LCH-301 ready (GO), LCH-302 mid-flight (HOLD), LCH-303 blocked (NO-GO, open SEV-2 INC-2214 in Cards and support macros blocked), LCH-304 early (HOLD).
- The gate is GO only when every critical item is done with evidence, no SEV-1 or SEV-2 incident is open in the area, enablement items are done 2 days before target, and every sign-off matches the current checklist fingerprint.
- Any checklist change makes earlier sign-offs stale. A GO decision cannot be recorded unless the gate says GO; a recorded decision goes stale if the checklist changes afterwards.
- "Done" requires evidence; "Blocked" requires a reason. Both are refused without them.

### 3. Incident Board

- 13 incidents with severity (SEV-1 to SEV-4), commander, accounts affected, customer impact, timeline, time to mitigate and time to resolve against SLA (4h, 24h, 72h, 7 days).
- Resolving requires a root-cause category and a note of at least 20 characters.
- Resolved SEV-1 to SEV-3 incidents need a post-incident review (due in 5 days for SEV-1/2, 10 for SEV-3): a summary, at least three whys, and at least one action item with owner and due date. Reviews show as missing, draft, overdue or complete.
- Repeats are flagged when an incident shares area and root-cause category with another within 60 days.
- Incidents link to customer-voice themes and launches; an open SEV-1/2 blocks launches in its area.

### Overview

Front-page framing, one sample-data line, four headline numbers, the "connective tissue" chain (theme → incident → launch) and a recent activity feed.

## Non-goals (v1)

- No connection to real Ramp systems, customers or data.
- No language-model calls. The triage agent is deterministic and explains itself; a model could replace the scorer behind the same interface later.
- No user accounts or roles; each visitor gets a private workspace.
- No outbound notifications (Slack, email, status page).

## Architecture

- React and Vite frontend, served as static assets by a Cloudflare Worker.
- One SQLite-backed Durable Object per visitor (cookie `rlc_visitor`), so visitors never see each other's changes.
- A single write path: `POST /api/command` with an allowlisted command, an idempotency key and the expected revision. Stale revisions get 409; a reused key for a different command gets 409; a retry of the same command replays the stored result without writing again. Refused business rules return 422 with the reason.
- The API refuses cross-origin writes, non-JSON bodies, invalid UTF-8 and bodies over 256 KB.
- Static fallback: the same engine runs in the browser with localStorage when deployed to GitHub Pages.

## Acceptance criteria

1. 40+ feedback items across all four areas, every one with a rationale. (50 seeded.)
2. One launch ready, one mid-flight, one blocked with a clear reason.
3. Every resolved SEV-1 to SEV-3 incident shows a review state; completed reviews show whys and action items.
4. One sample-data line on the overview, no demo banners.
5. Literal Ramp wordmark top-left on desktop and mobile.
6. No serious or critical accessibility violations at 1366px and 390px.
7. All checks in [TEST_PLAN.md](TEST_PLAN.md) pass.
