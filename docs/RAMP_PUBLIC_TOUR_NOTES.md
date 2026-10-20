# What I learned from Ramp's public product surfaces

Ramp does not offer a self-serve sandbox. Its free plan is a real business account, and signing up needs a company, an EIN and identity verification, so I did not create one with invented details. Everything here comes from public pages and the public interactive product tour linked from ramp.com/see-a-demo, viewed on 20 Oct 2026. Nothing here is from inside Ramp.

## Product tour (7 steps: Overview, Cards, virtual cards, Expenses, Bill Pay, Accounting, Perks)

- **Navigation model:** a left rail with Inbox (with a count), Insights, My Ramp, then product areas (Expenses with Card transactions, Reimbursements and Travel; Cards; Spend programs; Procurement; Bill Pay with Bills and Flex; Accounting with a count; People; Vendors), then Settings. I reuse this model: product areas own work, and counts sit on the nav.
- **Every list is a work queue with states:** Reimbursements use Overview, Needs review, Pending and History; Bills use Overview, Drafts, For approval, For payment and History. Rows carry status chips such as "Missing info" (amber), "Pending review" (neutral) and "Paid" (green). Launch Control's queues use the same pattern: Needs triage / Routed / Watch for feedback, and Open / Mitigated / Resolved for incidents.
- **Totals and denominators in the footer:** "1–50 of 238 reimbursements · $274,966.63 total" and "1–26 of 26 bills · $1,454,206.04 total". Every Launch Control table ends with the same kind of footer (items, distinct accounts, ARR represented).
- **One loud action per page:** Issue Card, Create reimbursement and New bill are the only solar-yellow buttons. Secondary actions (Requests, Reminders, Recurring bills) are outlined.
- **Product claims shown in the tour,** quoted as stated and not verified: invoice extraction "with 99.9% accuracy", "Pay by card, ACH, or check", "Issue unlimited virtual cards with custom rules by merchant, category, amount, and frequency of reload", "custom policies, automatic expense categorization, and automated receipt collection".

## Public pages

- ramp.com/products lists the core products: Corporate cards, Expense management, Accounts payable, Travel, Business banking and Procurement. Launch Control's four product areas (Cards, Expenses, Bill Pay, Travel) are taken from that list.
- ramp.com/product-releases publishes a monthly "New on Ramp" edition plus an "All updates" feed. That cadence is why the launch checklist includes a "Product updates entry drafted" comms item.
- The Product Operations Specialist postings (Ashby job board) describe the job as voice of the customer, process development, product analysis, launch support ("ensure that product releases are flawless through documentation, enablement and context sharing"), incident management ("fast resolution of product bugs and issues") and partner ops. The Procurement posting names its goal metric as "support tickets per active user and customer NPS". The three modules map onto the first five of those.

## What this changed in the build

1. Product areas, not teams, are the routing unit. This matches how the product is organised publicly.
2. Queues have explicit states and footers with denominators instead of free-form dashboards.
3. Launch readiness includes help-centre, product-updates and support-macro items, because those are the public-facing artefacts a release touches.
4. The primary metric proposed in [METRICS.md](METRICS.md) is the posting's own "support tickets per active user", segmented by product area.
