# Decision log

My decisions while building Ramp Launch Control, newest last.

| # | Decision | Why | Trade-off I accepted |
| --- | --- | --- | --- |
| 1 | Brand research before any code: DESIGN.md and a rendered brand guide first | The brief asked for Ramp's real look; deciding tokens up front kept every screen consistent | Slower first commit |
| 2 | Use Ramp's literal wordmark from ramp.com, with a non-affiliation line in the footer | The brief asked for the literal logo top-left; the footer makes clear it's an independent concept | The wordmark belongs to Ramp; credited as such |
| 3 | Inter instead of TWK Lausanne | Lausanne is a licensed font served from Ramp's own CDN; I don't redistribute it. Inter is the closest open grotesk | Slightly different letterforms |
| 4 | Did not open a Ramp account | Signing up needs a real business, an EIN and identity checks; I won't invent those. I used the public product tour and wrote up what I learned | Learnings come from the public tour, not a live account |
| 5 | Deterministic triage agent, no model calls | Explainable routes, repeatable tests, zero running cost. Every route says which phrases matched and what it beat | Keyword lists need upkeep; v2 can swap the scorer |
| 6 | The agent abstains rather than guesses | A wrong route wastes an owner's time and erodes trust in the whole list | 3 of 50 seed items need a person |
| 7 | Score = distinct accounts × ARR ($M), and 3+ accounts to rank | Frequency × revenue impact, as asked, but counting accounts not mentions so one loud account can't top the list | Mileage (6 mentions, 1 account) stays on watch on purpose |
| 8 | Launch gate fails closed | A launch that's "mostly ready" is how support gets surprised | Owners must attach evidence to mark done |
| 9 | Sign-offs and decisions bound to a checklist fingerprint | A sign-off on last week's plan shouldn't count for this week's | More re-signing when plans change |
| 10 | An open SEV-1/2 in the area blocks a launch | The blocked launch (LCH-303) shows why: shipping limit increases while card declines are broken would multiply tickets | Can block unrelated features in the same area |
| 11 | Reviews need three whys and an owned action | Short enough to actually do; structured enough to find the cause | Some reviews will feel thin; repeats show when they were |
| 12 | One SQLite Durable Object per visitor | Anyone with the link can use it without seeing other visitors' changes, and state persists across reloads | Workspaces aren't shared between people |
| 13 | Idempotency keys and revision checks on every write | Double-clicks and retries must never apply a change twice | Slightly more client code |
| 14 | Business-rule refusals return 422 with the reason; conflicts return 409 | The UI can show the exact reason a gate refused | — |
| 15 | GitHub Pages fallback runs the same engine in the browser | One codebase for both hosts | Fallback state lives in that browser only |
| 16 | One short sample-data line, no banners | As asked; the line states the counts and that no real Ramp customers or systems are involved | — |
