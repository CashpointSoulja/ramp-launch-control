# Source ledger

Every fact about Ramp used in this repo is listed here with the public page it came from. All were fetched on 20 Oct 2026. Anything not listed is my own design choice or synthetic data.

| # | Source | What was taken | Used in |
|---|---|---|---|
| S1 | https://ramp.com (homepage HTML and CSS) | Wordmark SVG from the navbar; colour custom properties (`--solar #e4f222`, `--text-primary #0c0a08`, `--border-primary #d2cecb`, `--blaze`, `--smolder`, `--spring`); `@font-face` for TWK Lausanne and IBM Plex Mono; headline scale (64px w400); 6px CTA radius; homepage copy tone | DESIGN.md, brand guide, `public/brand/` |
| S2 | Ramp public product tour (capture.navattic.com link embedded on ramp.com/see-a-demo) | Product-app computed styles (sidebar `#F4F3EF`, muted `#707062`, outline `#91917B`, square buttons, pill badges); nav structure; queue tabs; status chips; totals footers; quoted product claims | DESIGN.md, RAMP_PUBLIC_TOUR_NOTES.md, UI |
| S3 | https://ramp.com/products | Core product names: Corporate cards, Expense management, Accounts payable, Travel, Business banking, Procurement | Product areas in the engine |
| S4 | https://ramp.com/product-releases | Monthly "New on Ramp" editions and the "All updates" feed | Launch checklist comms item |
| S5 | https://jobs.ashbyhq.com/ramp/081dbe29-8a06-4cb2-bda5-4b0bfb35c2e8 (Product Operations Specialist, Generalist) | Role responsibilities: voice of the customer, process development, product analysis, launch support, incident management, partner ops; 2+ years; SQL; NYC HQ at least 2 days a week | PRD, VIABILITY_MEMO, home framing |
| S6 | https://jobs.ashbyhq.com/ramp/871d2fc8-def8-4837-a9b0-7cc4fe126c2b (Product Operations Specialist, Procurement) | Goal metric quoted: "support tickets per active user and customer NPS"; Alpha-to-GA launch ownership | METRICS.md, launch stages |
| S7 | https://jobs.ashbyhq.com/ramp/dba53e68-4c96-449d-af4d-27dc475b814c (Product Operations Specialist, Juno) | Launch lifecycle wording: customer testing, launch readiness, change management, customer communication | PRD launch module |

The Ashby postings state "over $200B in annualized spend" and "70,000+ companies", while ramp.com/product-releases says "85,000+ businesses". The figures differ and neither is used in the product.

Not used: Ramp's internal tools, data or processes. None of those are public, and nothing in this repo claims to know them.
