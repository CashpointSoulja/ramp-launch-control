# Ramp Launch Control: design system

This is the design reference for Ramp Launch Control, an independent concept by Ayo Ahmed. It is not affiliated with Ramp.
Everything below was captured from the public ramp.com site and Ramp's public interactive product tour on 20 Oct 2026. Sources are listed in [docs/SOURCES.md](docs/SOURCES.md). The visual guide is [docs/brand/BRAND_GUIDE.html](docs/brand/BRAND_GUIDE.html), with a rendered copy at [docs/brand/brand-guide.png](docs/brand/brand-guide.png).

## 1. What "looks like Ramp" means here

There are two Ramp surfaces, and they feel different:

| Surface | Where seen | Feel |
|---|---|---|
| Marketing site | ramp.com | White canvas with a faint dotted grid, very large light-weight headlines (64px, weight 400, tight tracking), solar-yellow primary CTA, near-black secondary CTA, 6px radius. |
| Product app | Public product tour (Cards, Reimbursements, Bills) | Warm off-white sidebar, a breadcrumb over a large page title, underline tabs, square (0px radius) buttons with solar yellow as the single primary action, thin-ruled data tables, pill count badges in yellow, and footers with totals such as "1–26 of 26 bills · $1,454,206.04 total". |

Launch Control is an operations tool, so it copies the **product app** surface. The home view borrows the marketing headline style for the three framing lines only.

## 2. Logo

- The literal Ramp wordmark, extracted unchanged from the inline SVG in the ramp.com navbar: [`public/brand/ramp-wordmark.svg`](public/brand/ramp-wordmark.svg) (near-black) and [`public/brand/ramp-wordmark-white.svg`](public/brand/ramp-wordmark-white.svg).
- The wing mark is the last sub-path of that same SVG path, cropped with a new viewBox and otherwise unchanged: [`public/brand/ramp-mark.svg`](public/brand/ramp-mark.svg).
- Placement: top-left of the sidebar on desktop and top-left of the app bar on mobile, 75 x 20 px, the same size as on ramp.com.
- Rule: never redraw, recolour (except near-black or white), stretch or animate the mark.
- The wordmark always sits next to "Launch Control" in muted text, with the line "Independent concept by Ayo Ahmed. Not affiliated with Ramp." visible in the sidebar footer.
- Favicon: the wing mark on a solar tile ([`public/favicon.svg`](public/favicon.svg) plus a generated `favicon.ico`). Ramp's own favicon file is not reused.

## 3. Colour

Hex values were read from ramp.com CSS custom properties and from computed styles in the product tour.

| Token | Hex | Source | Use |
|---|---|---|---|
| `--solar` | `#E4F222` | ramp.com `--solar`; tour primary buttons and badges `rgb(228,242,34)` | The single primary action per view, count badges, the GO verdict fill. Never used for text. |
| `--ink` | `#1C1B17` | tour dark button `rgb(28,27,23)` | Dark buttons, mobile app bar. |
| `--text` | `#2E2E27` | tour body text `rgb(46,46,39)` | Primary text. |
| `--text-strong` | `#0C0A08` | ramp.com `--text-primary` | Headlines, wordmark. |
| `--muted` | `#707062` | tour nav and table headers `rgb(112,112,98)` | Secondary text, nav items, column headers. |
| `--outline` | `#91917B` | tour secondary button border `rgb(145,145,123)` | Secondary button borders. |
| `--sidebar` | `#F4F3EF` | tour aside `rgb(244,243,239)` | Sidebar, filter chips, neutral pills. |
| `--active` | `#EBE8E5` | tour active nav `rgb(235,232,229)` | Active nav item, row hover. |
| `--chip` | `#DBDAC9` | tour export chip `rgb(219,218,201)` | Neutral emphasis chips. |
| `--rule` | `#E4E2DD` | derived (between `--active` and ramp.com `--border-primary #D2CECB`) | Table rules and card borders. |
| `--border` | `#D2CECB` | ramp.com `--border-primary` | Inputs, dividers. |
| `--canvas` | `#FFFFFF` | both | Content background. |
| `--blaze` | `#E96516` | ramp.com `--blaze` | Warning accents (HOLD, SEV-2). Text uses the darker `--warn-text`. |
| `--smolder` | `#17332D` | ramp.com `--smolder` | Deep green: resolved, paid, GO text. |
| `--spring` | `#5683D2` | ramp.com `--spring` | Informational accents (links in docs list). |

Status colours used in the app (tour status chips show green "Paid", amber "Missing info", neutral "Pending review"):

| Status | Text | Fill | Border |
|---|---|---|---|
| Positive (GO, Resolved, Routed) | `#1F5F3A` | `#E7F1E8` | `#B9D7BF` |
| Caution (HOLD, Mitigated, Watch) | `#7A4A00` | `#FBF1DC` | `#E6CF9A` |
| Negative (NO-GO, SEV-1, Rejected) | `#9B1C1C` | `#FBE9E7` | `#EBBDB6` |
| Neutral (Not started, Needs triage) | `#2E2E27` | `#F4F3EF` | `#DBDAC9` |

All text and fill pairs meet WCAG AA at 13px and up. This is checked by axe in `npm run ui:check`.

## 4. Type

| Role | Ramp uses | Launch Control uses | Size / weight |
|---|---|---|---|
| UI and headlines | TWK Lausanne (weights 300/350/400/700, served from assets.ramp.com) | **Inter** (SIL OFL, self-hosted via `@fontsource/inter`), the closest open neo-grotesk. Lausanne is a commercial Weltkern typeface and is not redistributed here. | Page title 40/44 w400, tracking -0.01em; section 20/26 w400; body 14/20 w400; small 12/18. |
| Numbers and IDs | IBM Plex Mono (ramp.com hero counters) | **IBM Plex Mono** (SIL OFL, `@fontsource/ibm-plex-mono`) | 12-13px for IDs (FB-1042, INC-2207), tabular amounts. |

Ramp keeps headlines at regular weight (400), not bold, and uses size and grey-vs-ink contrast for hierarchy: on ramp.com, "One platform for all of finance." is ink and the next line, "Agents for every workflow, working 24/7.", is grey. Launch Control does the same on its home page.

## 5. Layout

- Desktop (≥ 1024px): a 232px fixed sidebar (`--sidebar`), then content with 56px left and right padding and a 1120px maximum table width.
- Sidebar order, mirroring the tour: wordmark row, then search-like "Jump to" hint, then primary nav (Overview, Customer voice, Launches, Incidents) with yellow count badges, then a divider, then Docs. The independence line sits at the bottom.
- Page header: muted breadcrumb (14px) over a 40px title with a count in muted 16px. Actions sit right-aligned: secondary outlined buttons, then one solar primary.
- Tabs: text tabs with a 2px ink underline on the active tab, over a 1px rule.
- Tables: white, 1px `--rule` row separators, 56px rows, muted 12px column headers, amounts right-aligned in tabular figures, and a footer row with denominators and totals ("12 of 46 items · $3.1M ARR").
- Mobile (390px): the sidebar collapses to a dark (`--ink`) app bar with the white wordmark top-left and a menu button. Tables become stacked row cards or labelled horizontally scrollable regions that you can focus with the keyboard.

## 6. Components

- **Primary button:** `--solar` fill and border, `--text` label, 0px radius, 40px tall, 14px w400. At most one per view.
- **Secondary button:** white fill, 1px `--outline` border, 0px radius.
- **Ghost or icon button:** transparent, 860px (pill) radius on hover, `--sidebar` fill.
- **Count badge:** pill, `--solar` fill, 12px.
- **Status chip:** pill, 1px border, icon dot plus label, using the colours from section 3.
- **Filter chip:** `--sidebar` pill with a "+ Add filter" style.
- **Verdict block (launch go/no-go):** full-width band, with a solar fill for GO, a negative fill for NO-GO with the blocking reasons listed first, and a caution fill for HOLD.
- **Focus ring:** 2px `#2E2E27` outline with 2px offset. It is never removed.

## 7. Voice

Ramp's copy is short, declarative and concrete with numbers ("Time is money. Save both.", "Switch in days, not months"). Launch Control copy follows that: verbs on buttons ("Route to Bill Pay", "Sign off", "Declare incident"), numbers with denominators, and no exclamation marks.

## 8. What is deliberately not copied

- Ramp's marketing photography, celebrity creative, product screenshots and Lausanne font files are not copied.
- Real Ramp customer names and data are not used. Everything in the app is synthetic.
- Nothing implies access to Ramp internals. Product-area names (Cards, Expenses, Bill Pay, Travel) are the public product names on ramp.com/products. The owner names are invented.
