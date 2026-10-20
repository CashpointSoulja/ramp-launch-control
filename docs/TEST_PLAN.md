# Test plan and results

All results below are command output from a local run on 2026-10-20 (Node 24, Wrangler 4.43 local runtime, Chromium headless via Playwright 1.56, axe-core 4.10). Nothing here comes from a deployed URL; no deployment has been verified yet.

## What is tested

| Layer | Command | Covers |
| --- | --- | --- |
| Types | `npm run typecheck` | Engine, Worker and UI compile with `strict` |
| Unit | `npm test` | 24 tests: seed shape, triage (route, reject, abstain, cross-area, override), scoring and watch rule, launch gates (evidence, stale sign-offs, GO refusal), incidents (root cause required, block lifted on resolve, review completeness), CSV all-or-nothing, workspace idempotency, revisions, reset epoch, unknown commands |
| Evals | `npm run evals` | Seed goldens (40+ items, ready / mid-flight / blocked launches, ranked top theme) and a 14-item held-out triage set written after the keyword lists were fixed; gates: 0 wrong-area routes and 75%+ correct |
| Build | `npm run build`, `wrangler deploy --dry-run` | Production bundle and Worker bindings (`WORKSPACE` Durable Object, `ASSETS`) |
| API | `npm run test:api` | Health, security headers, HttpOnly visitor cookie, cross-origin 403, content-type 415, bad JSON and invalid UTF-8 400, 256 KB limit 413, unknown command 400, unknown route 404, wrong method 405, idempotent replay, key reuse 409, stale revision 409, GO refused 422, per-visitor isolation, persistence |
| Browser | `npm run ui:check` | Six routes at 1366px and 390px: axe serious/critical, console and HTTP errors, horizontal overflow, wordmark position, one sample-data line, no demo banner, favicon; flows: manual route, GO disabled on NO-GO, resolve incident → review, block lifted, persistence across reload |
| Static fallback | `npm run build:static`, then `ui:check` against the static files | Same browser checks with the in-browser engine |

## Results

| Check | Result |
| --- | --- |
| Typecheck | Pass, 0 errors |
| Unit tests | 24 of 24 passed |
| Evals | All passed; held-out 14/14 correct, 0 sent to a person, 0 wrong area |
| Build and dry run | Pass; upload 67.60 KiB (21.33 KiB gzip) |
| API checks | 20 of 20 passed against `wrangler dev` |
| UI checks (Worker) | 29 of 29 passed |
| UI checks (static fallback) | 29 of 29 passed |

The held-out set is small (14 items). It shows the agent is not overfitted to the seed; it is not evidence of production accuracy.

### Issues found and fixed during testing

- The Worker failed to start because `src/worker.ts` exported a constant alongside the handler; only `default` and `Workspace` are exported now.
- axe flagged the hint text on the NO-GO panel at 4.28:1 contrast; darkened to pass 4.5:1.
- The "Needs a person" tab count (4) disagreed with the nav badge (3) because it included the rejected item; renamed to "Not routed".
- Sign-off is refused while critical items are open (422 `not_ready`); the API idempotency check now uses an incident update instead.

### Raw output (Worker run)

```text
      Tests  24 passed (24)
PASS  seed has 40+ items  (50)
PASS  every seed item has a rationale
PASS  LCH-301 ready (GO)
PASS  LCH-302 mid-flight
PASS  LCH-303 blocked with reason
PASS  top theme has 3+ distinct accounts  (T-CARD-DECL 7 accounts)
held-out: 14/14 correct, 0 sent to a person, 0 wrong area
PASS  held-out wrong-area routes = 0  (0)
PASS  held-out accuracy >= 75%  (100%)
all evals passed
PASS  health 200
PASS  security headers
PASS  visitor cookie issued HttpOnly
PASS  fresh workspace seeded  (50 items)
PASS  reset 200
PASS  cross-origin write 403
PASS  wrong content-type 415
PASS  bad JSON 400
PASS  invalid UTF-8 400
PASS  oversized body 413
PASS  unknown command 400
PASS  unknown route 404
PASS  GET on command 405
PASS  command applies
PASS  retry replays, no second write
PASS  key reuse for other command 409
PASS  stale revision 409
PASS  GO refused while gate is NO-GO 422
PASS  second visitor gets an isolated workspace
PASS  write persisted
all API checks passed
PASS  desktop overview: axe serious/critical = 0
PASS  desktop voice: axe serious/critical = 0
PASS  desktop launches: axe serious/critical = 0
PASS  desktop launch-blocked: axe serious/critical = 0
PASS  desktop incidents: axe serious/critical = 0
PASS  desktop incident-closed: axe serious/critical = 0
PASS  desktop: Ramp wordmark top-left  (22,25)
PASS  desktop: one sample-data line
PASS  desktop: no demo banner
PASS  desktop: favicon 200
PASS  desktop: no horizontal overflow  (0px)
PASS  desktop: no console or HTTP errors
PASS  mobile overview: axe serious/critical = 0
PASS  mobile voice: axe serious/critical = 0
PASS  mobile launches: axe serious/critical = 0
PASS  mobile launch-blocked: axe serious/critical = 0
PASS  mobile incidents: axe serious/critical = 0
PASS  mobile incident-closed: axe serious/critical = 0
PASS  mobile: Ramp wordmark top-left  (18,18)
PASS  mobile: one sample-data line
PASS  mobile: no demo banner
PASS  mobile: favicon 200
PASS  mobile: no horizontal overflow  (0px)
PASS  mobile: no console or HTTP errors
PASS  voice: manual route clears an item from the queue  (Not routed 4 → Not routed 3)
PASS  launch: GO button disabled while NO-GO
PASS  incident: resolve opens the post-incident review
PASS  launch: resolving INC-2214 removes it as a blocker
PASS  persistence: resolved state survives reload
all UI checks passed
```

## Manual checks

Desktop (1366px) and mobile (390px) screenshots of every route were inspected by eye; see `docs/screenshots/`.

## Not tested

- A deployed Cloudflare or GitHub Pages URL.
- Browsers other than Chromium.
- Load beyond a single visitor per Durable Object.
