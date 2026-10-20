import type { Channel, ChecklistItem, FeedbackItem, Incident, ItemCategory, ItemStatus, Launch, Segment, Severity, SignoffRole, WorkspaceState, RootCause, Pir } from './types.ts';
import { DAY, HOUR, iso, isoDate } from './util.ts';
import { launchFingerprint } from './launch.ts';

type Acct = readonly [string, string, Segment, number];
const ACCOUNTS: Record<string, Acct> = Object.fromEntries(([
  ['ACC-2041', 'Northwind Labs', 'mid_market', 420_000], ['ACC-2187', 'Northwind Labs', 'smb', 96_000],
  ['ACC-2102', 'Halden Freight', 'enterprise', 1_850_000], ['ACC-2110', 'Brightwater Clinics', 'mid_market', 610_000],
  ['ACC-2115', 'Copperline Studio', 'smb', 54_000], ['ACC-2121', 'Tessaro Foods', 'mid_market', 380_000],
  ['ACC-2133', 'Kestrel Robotics', 'enterprise', 2_400_000], ['ACC-2140', 'Marlow & Finch', 'smb', 72_000],
  ['ACC-2146', 'Orchid Health', 'mid_market', 530_000], ['ACC-2152', 'Pinecrest Schools', 'mid_market', 290_000],
  ['ACC-2158', 'Quayside Logistics', 'enterprise', 1_320_000], ['ACC-2163', 'Redfern Analytics', 'smb', 88_000],
  ['ACC-2169', 'Saltmarsh Brewing', 'smb', 61_000], ['ACC-2174', 'Tidewell Energy', 'enterprise', 2_150_000],
  ['ACC-2180', 'Umber Architects', 'smb', 47_000], ['ACC-2192', 'Verity Payroll', 'mid_market', 450_000],
  ['ACC-2198', 'Wexford Retail', 'enterprise', 1_760_000], ['ACC-2203', 'Yarrow Media', 'smb', 69_000],
  ['ACC-2209', 'Zephyr Climbing', 'smb', 38_000], ['ACC-2214', 'Ashgrove Dental', 'mid_market', 260_000],
  ['ACC-2220', 'Bramble Software', 'mid_market', 720_000], ['ACC-2226', 'Calder Hotels', 'enterprise', 1_490_000],
  ['ACC-2231', 'Dunmore Events', 'smb', 83_000], ['ACC-2237', 'Elmstead Capital', 'mid_market', 940_000],
  ['ACC-2242', 'Fenwick Biotech', 'enterprise', 2_980_000], ['ACC-2248', 'Glasswing Travel', 'mid_market', 340_000],
  ['ACC-2253', 'Harbor & Vine', 'smb', 57_000], ['ACC-2259', 'Ironbark Construction', 'mid_market', 810_000],
  ['ACC-2264', 'Juniper Legal', 'smb', 92_000], ['ACC-2270', 'Larkspur Nonprofit', 'smb', 41_000],
  ['ACC-2275', 'Meridian Freightworks', 'enterprise', 1_640_000], ['ACC-2281', 'Nettlefield Farms', 'smb', 66_000],
] as const).map((a) => [a[0], a as Acct]));

// [id, hours before anchor, channel, account, text]
const FEEDBACK: ReadonlyArray<readonly [string, number, Channel, string, string]> = [
  ['FB-1001', 6, 'support_ticket', 'ACC-2041', 'Our virtual card for the design tool was declined again at renewal. Third month in a row.'],
  ['FB-1002', 9, 'shared_slack', 'ACC-2133', 'Engineering virtual card declined at two SaaS vendors this morning, both show MCC 5734.'],
  ['FB-1003', 14, 'csm_call', 'ACC-2220', 'CFO raised that subscription renewals keep getting declined on the virtual card even with budget left.'],
  ['FB-1004', 20, 'support_ticket', 'ACC-2242', 'Cloud hosting charge declined on a virtual card that has a 50k limit. Merchant says it is an MCC issue.'],
  ['FB-1005', 27, 'in_app', 'ACC-2163', 'Declined at our analytics SaaS. The decline reason in the app just says merchant not allowed.'],
  ['FB-1006', 33, 'nps_comment', 'ACC-2203', 'Love the product but random card declines on software subscriptions make us look bad to vendors.'],
  ['FB-1007', 41, 'csm_call', 'ACC-2237', 'Treasury team says SaaS renewals were declined twice this week on virtual cards.'],
  ['FB-1008', 52, 'support_ticket', 'ACC-2133', 'Same issue as last ticket: virtual card declined at a SaaS tool, finance is escalating.'],
  ['FB-1009', 8, 'support_ticket', 'ACC-2187', 'Bills sit for days because the approver is out of office and there is no delegate.'],
  ['FB-1010', 16, 'csm_call', 'ACC-2102', 'AP lead says invoices are stuck waiting on approval whenever a regional approver is travelling.'],
  ['FB-1011', 30, 'shared_slack', 'ACC-2259', 'Can we set a delegate for the approval chain? Project managers go out of office for weeks.'],
  ['FB-1012', 47, 'sales_call', 'ACC-2192', 'Prospect expansion blocked on approval chain delegation for out of office approvers.'],
  ['FB-1013', 66, 'support_ticket', 'ACC-2275', 'Approver left the company and 14 bills are stuck in the approval chain.'],
  ['FB-1014', 90, 'support_ticket', 'ACC-2102', 'Again: approver out of office, bills stuck, vendor chasing us for payment.'],
  ['FB-1015', 11, 'support_ticket', 'ACC-2158', 'Invoice capture misread the line items on a 3-page freight invoice and merged two rows.'],
  ['FB-1016', 25, 'csm_call', 'ACC-2121', 'Line items extracted from supplier invoices are often misread when the PDF has a table border.'],
  ['FB-1017', 39, 'in_app', 'ACC-2146', 'PO number not picked up from the invoice and the line items were misread.'],
  ['FB-1018', 58, 'support_ticket', 'ACC-2198', 'Bulk invoice upload misread line item quantities for our store fixtures vendor.'],
  ['FB-1019', 75, 'support_ticket', 'ACC-2158', 'Second freight invoice this month with misread line items.'],
  ['FB-1020', 12, 'support_ticket', 'ACC-2110', 'Forwarded receipts to the receipts inbox but they stay unmatched to the card transaction.'],
  ['FB-1021', 22, 'in_app', 'ACC-2115', 'I forwarded my receipt three days ago and it is still unmatched.'],
  ['FB-1022', 36, 'csm_call', 'ACC-2152', 'Teachers forward receipts from personal email and they never match.'],
  ['FB-1023', 49, 'nps_comment', 'ACC-2231', 'Receipt matching works in the app but forwarded receipts often end up unmatched.'],
  ['FB-1024', 70, 'support_ticket', 'ACC-2264', 'Missing receipt reminders keep firing for receipts I already forwarded.'],
  ['FB-1025', 10, 'csm_call', 'ACC-2226', 'Travellers could not rebook the hotel after the conference schedule change moved by a day.'],
  ['FB-1026', 28, 'support_ticket', 'ACC-2248', 'Hotel rebooking after a schedule change means cancelling and booking again at a higher rate.'],
  ['FB-1027', 44, 'shared_slack', 'ACC-2174', 'Field crew needed to rebook hotels when the site visit slipped, had to call the hotel directly.'],
  ['FB-1028', 80, 'support_ticket', 'ACC-2226', 'Another hotel rebook request: check-in moved and the app could not change it.'],
  ['FB-1029', 7, 'support_ticket', 'ACC-2281', 'Need UK mileage rates per HMRC for our farm visits, not per mile US rates.'],
  ['FB-1030', 19, 'support_ticket', 'ACC-2281', 'Mileage still shows US rate. Our UK drivers claim in kilometre.'],
  ['FB-1031', 31, 'support_ticket', 'ACC-2281', 'Following up on mileage rates for UK team.'],
  ['FB-1032', 43, 'support_ticket', 'ACC-2281', 'Mileage claims rejected by our accountant because the rate is wrong for HMRC.'],
  ['FB-1033', 61, 'in_app', 'ACC-2281', 'Mileage: please add HMRC rate.'],
  ['FB-1034', 85, 'support_ticket', 'ACC-2281', 'Mileage rate for UK is still wrong, can someone call me back.'],
  ['FB-1035', 15, 'support_ticket', 'ACC-2140', 'We asked for a card limit increase on Monday and it is still pending.'],
  ['FB-1036', 34, 'csm_call', 'ACC-2169', 'Brewery owner wants to raise the limit before a supplier order and the limit request takes days.'],
  ['FB-1037', 56, 'in_app', 'ACC-2253', 'Limit increase requests need a faster path for one-off purchases.'],
  ['FB-1038', 18, 'support_ticket', 'ACC-2180', 'Vendor says the ACH arrived a day after the payment date we picked.'],
  ['FB-1039', 38, 'support_ticket', 'ACC-2209', 'A vendor changed bank details and we were not asked to verify before the ACH went out.'],
  ['FB-1040', 63, 'csm_call', 'ACC-2214', 'Remittance emails for ACH payments are missing the invoice numbers.'],
  ['FB-1041', 24, 'sales_call', 'ACC-2133', 'Flight change fee did not come through to the expense, so the trip total is wrong.'],
  ['FB-1042', 54, 'support_ticket', 'ACC-2270', 'Airline charged a change fee and the fare difference never showed in Ramp.'],
  ['FB-1043', 29, 'support_ticket', 'ACC-2198', 'Store managers on per diem get flagged even when the meal allowance is within policy.'],
  ['FB-1044', 68, 'in_app', 'ACC-2121', 'Per diem for our drivers is flagged every single day.'],
  ['FB-1045', 46, 'support_ticket', 'ACC-2174', 'Physical card shipping to our Calgary office took three weeks and the courier lost one.'],
  ['FB-1046', 72, 'csm_call', 'ACC-2242', 'Execs want a travel policy exception flow for business class on long-haul.'],
  ['FB-1047', 13, 'support_ticket', 'ACC-2152', 'Our approver keeps sending back per diem claims and we do not know why.'],
  ['FB-1048', 26, 'in_app', 'ACC-2231', 'Not sure if this is an invoice or a receipt problem, the PDF upload failed.'],
  ['FB-1049', 40, 'nps_comment', 'ACC-2264', 'The reports page has felt slow for the last two weeks.'],
  ['FB-1050', 3, 'in_app', 'ACC-2203', 'broken??'],
];

function buildFeedback(anchor: number): FeedbackItem[] {
  return FEEDBACK.map(([id, h, channel, acct, text]) => {
    const a = ACCOUNTS[acct];
    return { id, receivedAt: iso(anchor - h * HOUR), channel, accountId: a[0], accountName: a[1], segment: a[2], arrUsd: a[3], text };
  });
}

const TEMPLATE: ReadonlyArray<readonly [ItemCategory, string, boolean]> = [
  ['enablement', 'Help centre article published', true],
  ['enablement', 'Internal FAQ and sales talk track', true],
  ['enablement', 'CX and support training delivered', true],
  ['support', 'Support macros published', true],
  ['support', 'Tier-1 runbook and escalation path', true],
  ['support', 'Launch-week support staffing confirmed', false],
  ['quality', 'QA sign-off on staging', true],
  ['quality', 'Feature flag and rollback tested', true],
  ['comms', 'Customer email approved', false],
  ['comms', 'Product updates entry drafted', false],
  ['measurement', 'Success metric and guardrail defined', true],
  ['measurement', 'Launch dashboard live', false],
];

function items(launchId: string, target: number, spec: ReadonlyArray<readonly [ItemStatus, string | null, string?]>, owners: readonly string[]): ChecklistItem[] {
  return TEMPLATE.map(([category, label, critical], i) => {
    const [status, evidence, blockedReason] = spec[i];
    return {
      id: `${launchId}-${String(i + 1).padStart(2, '0')}`, category, label, critical,
      owner: owners[i % owners.length], due: isoDate(target - (category === 'enablement' ? 3 : 1) * DAY),
      status, evidence: status === 'done' ? evidence : null, blockedReason: status === 'blocked' ? (blockedReason ?? null) : null,
    };
  });
}

const D = (s: string): ['done', string] => ['done', s];

function buildLaunches(anchor: number): Launch[] {
  const mk = (l: Omit<Launch, 'signoffs' | 'decision'>, signed: SignoffRole[], hoursAgo: number): Launch => {
    const base: Launch = { ...l, signoffs: [], decision: null };
    const fp = launchFingerprint(base);
    base.signoffs = signed.map((role) => ({ role, name: l.people[role], at: iso(anchor - hoursAgo * HOUR), fingerprint: fp }));
    return base;
  };
  const t301 = anchor + 6 * DAY, t302 = anchor + 12 * DAY, t303 = anchor + 3 * DAY, t304 = anchor + 27 * DAY;
  return [
    mk({
      id: 'LCH-301', name: 'Hotel rebooking on schedule change', area: 'travel', stage: 'ga', targetDate: isoDate(t301),
      summary: 'Travellers can move a hotel stay when a trip date shifts, without cancelling and rebooking at a new rate.',
      people: { pm: 'Tomás Herrera', eng: 'Wen Li', support: 'Grace Okafor', prodops: 'Ayo Ahmed' }, linkedThemeIds: ['T-TR-HOTEL'],
      items: items('LCH-301', t301, [D('help/travel/rebook-hotel (published)'), D('Notion: Travel FAQ v3'), D('CX training 14 Oct, 41 of 44 agents'), D('Macros TR-112 to TR-115 live'), D('Runbook RB-travel-07 + #travel-escalations'), D('Rota: 6 agents launch week'), D('QA run 2291, 0 open P1/P2'), D('Flag travel_rebook, rollback drill 15 Oct'), D('Email v2 approved by Legal'), D('Draft in product updates queue'), D('Rebook completion rate; guardrail: rebook-related tickets per 1k trips'), D('Dashboard: Travel / Rebook')], ['Wen Li', 'Grace Okafor', 'Tomás Herrera']),
    }, ['pm', 'eng', 'support', 'prodops'], 20),
    mk({
      id: 'LCH-302', name: 'Approval delegation for multi-entity bills', area: 'billpay', stage: 'beta', targetDate: isoDate(t302),
      summary: 'Approvers can name a delegate and dates; bills route to the delegate instead of waiting in the chain.',
      people: { pm: 'Elena Sorensen', eng: 'Ravi Menon', support: 'Hannah Kim', prodops: 'Ayo Ahmed' }, linkedThemeIds: ['T-BP-APPROVAL'],
      items: items('LCH-302', t302, [D('help/bill-pay/approval-delegates (draft live in beta)'), ['in_progress', null], ['not_started', null], ['in_progress', null], D('Runbook RB-billpay-11'), ['not_started', null], D('QA run 2304, 1 open P3'), ['in_progress', null], ['not_started', null], ['not_started', null], D('Bills waiting on an out-of-office approver; guardrail: misrouted approvals'), ['in_progress', null]], ['Ravi Menon', 'Hannah Kim', 'Elena Sorensen']),
    }, ['pm'], 30),
    mk({
      id: 'LCH-303', name: 'Self-serve virtual card limit increases', area: 'cards', stage: 'ga', targetDate: isoDate(t303),
      summary: 'Card owners request a one-off limit increase that auto-approves inside policy bands.',
      people: { pm: 'Priya Raman', eng: 'Jonah Weiss', support: 'Grace Okafor', prodops: 'Ayo Ahmed' }, linkedThemeIds: ['T-CARD-LIMIT', 'T-CARD-DECL'],
      items: items('LCH-303', t303, [D('help/cards/limit-increase'), D('Notion: Cards FAQ v5'), D('CX training 16 Oct'), ['blocked', null, 'Decline messaging is changing while INC-2214 is open; macros cannot be finalised.'], D('Runbook RB-cards-04'), D('Rota: 5 agents launch week'), D('QA run 2310'), ['in_progress', null], D('Email v1 approved'), D('Draft in product updates queue'), D('Self-serve increase rate; guardrail: declines per 1k card transactions'), D('Dashboard: Cards / Limits')], ['Jonah Weiss', 'Grace Okafor', 'Priya Raman']),
    }, [], 0),
    mk({
      id: 'LCH-304', name: 'Forwarded-email receipt matching v2', area: 'expenses', stage: 'alpha', targetDate: isoDate(t304),
      summary: 'Receipts forwarded from any verified address match to card transactions by amount, merchant and date window.',
      people: { pm: 'Marcus Bell', eng: 'Sofia Andrade', support: 'Hannah Kim', prodops: 'Ayo Ahmed' }, linkedThemeIds: ['T-EXP-RCPT'],
      items: items('LCH-304', t304, [['not_started', null], ['not_started', null], ['not_started', null], ['not_started', null], ['not_started', null], ['not_started', null], ['in_progress', null], ['not_started', null], ['not_started', null], ['not_started', null], D('Match rate on forwarded receipts; guardrail: false matches per 1k'), ['not_started', null]], ['Sofia Andrade', 'Marcus Bell']),
    }, [], 0),
  ];
}

const pir = (summary: string, whys: string[], actions: Array<[string, string, number, boolean]>, completedAt: number | null, anchor: number, prefix: string): Pir => ({
  status: completedAt === null ? 'draft' : 'complete', summary, whys,
  actionItems: actions.map(([text, owner, dueDays, done], i) => ({ id: `${prefix}-A${i + 1}`, text, owner, due: isoDate(anchor + dueDays * DAY), done })),
  completedAt: completedAt === null ? null : iso(completedAt),
});

function buildIncidents(anchor: number): Incident[] {
  const inc = (id: string, title: string, area: Incident['area'], severity: Severity, detectedH: number, mitigateH: number | null, resolveH: number | null, commander: string, accounts: number, impact: string, cause: RootCause | null, note: string | null, theme: string | null, launch: string | null, p: Pir | null, updates: Array<[number, string]> = []): Incident => {
    const detected = anchor - detectedH * HOUR;
    return {
      id, title, area, severity, status: resolveH !== null ? 'resolved' : mitigateH !== null ? 'mitigated' : 'investigating',
      detectedAt: iso(detected), mitigatedAt: mitigateH === null ? null : iso(detected + mitigateH * HOUR), resolvedAt: resolveH === null ? null : iso(detected + resolveH * HOUR),
      commander, accountsAffected: accounts, customerImpact: impact, rootCause: cause, rootCauseNote: note, linkedThemeId: theme, linkedLaunchId: launch,
      updates: updates.map(([h, text]) => ({ at: iso(detected + h * HOUR), text })), pir: p,
    };
  };
  const ago = (d: number) => anchor - d * DAY;
  return [
    inc('INC-2195', 'CAD receipts mapped tax into subtotal', 'expenses', 3, 82 * 24, 10, 30, 'Sofia Andrade', 64, 'Canadian receipts showed the wrong subtotal, so accounting exports were off by the GST amount.', 'data_mapping', 'Receipt parser treated GST/HST as part of the subtotal for CAD after a locale table change.', 'T-EXP-RCPT', null,
      pir('Locale table change mapped GST into subtotal for CAD receipts.', ['Exports showed wrong subtotals.', 'Parser read GST as subtotal.', 'Locale table changed field order.', 'No fixture for CAD receipts in parser tests.'], [['Add CAD/AUD receipt fixtures to parser tests', 'Sofia Andrade', -60, true], ['Alert on subtotal/total ratio drift', 'Wen Li', -50, true]], ago(78), anchor, 'INC-2195')),
    inc('INC-2198', 'MCC block-list update declined airline merchants', 'cards', 2, 52 * 24, 3, 9, 'Jonah Weiss', 212, 'Cards with travel rules declined at three airlines for nine hours.', 'config_change', 'A block-list refresh shipped without the airline MCC allowlist merged in.', 'T-CARD-DECL', null,
      pir('Block-list refresh overwrote the airline allowlist.', ['Airline transactions declined.', 'MCC 3000-3350 hit the block list.', 'Refresh replaced the list instead of merging.', 'Refresh job had no diff review.'], [['Require diff review for MCC list changes', 'Jonah Weiss', -40, true], ['Canary MCC changes on 1% of cards', 'Priya Raman', -30, true]], ago(49), anchor, 'INC-2198')),
    inc('INC-2201', 'ACH file to bank partner delayed a day', 'billpay', 1, 58 * 24, 2, 6, 'Ravi Menon', 1140, '1,140 vendor payments landed a business day late.', 'partner_outage', 'Bank partner SFTP endpoint rejected the file after a certificate rotation on their side.', 'T-BP-ACH', null,
      pir('Partner certificate rotation rejected the nightly ACH file.', ['Payments landed late.', 'Nightly file was rejected.', 'Partner rotated their SFTP certificate.', 'Rotation notice went to an unmonitored inbox.', 'No synthetic check on file acceptance.'], [['Route partner notices to #billpay-partners', 'Elena Sorensen', -50, true], ['Synthetic file-acceptance check every 15 min', 'Ravi Menon', -45, true]], ago(55), anchor, 'INC-2201'), [[1, 'File rejected at 02:10 ET; partner engaged.'], [2, 'Manual resend accepted; payments will land T+1.']]),
    inc('INC-2203', 'Hotel inventory feed returned stale rates', 'travel', 3, 50 * 24, 6, 20, 'Wen Li', 38, 'Travellers saw prices that changed at checkout.', 'third_party_api', 'Supplier cache TTL raised from 5 to 60 minutes without notice.', 'T-TR-HOTEL', null,
      pir('Supplier raised cache TTL; stale rates surfaced at checkout.', ['Checkout price differed from search.', 'Search used cached supplier rates.', 'Supplier raised their cache TTL.'], [['Re-price at checkout and show the change', 'Wen Li', -35, true]], ago(46), anchor, 'INC-2203')),
    inc('INC-2205', 'Mileage map pin offset on Android', 'expenses', 4, 44 * 24, 24, 60, 'Sofia Andrade', 19, 'Pins showed about 200m off; distances were correct.', 'release_regression', 'Map SDK upgrade changed the default projection.', 'T-EXP-MILE', null, null),
    inc('INC-2207', 'ACH return notifications late from bank partner', 'billpay', 2, 31 * 24, 4, 15, 'Ravi Menon', 96, 'Returned ACH payments were reported to customers up to 15 hours late.', 'partner_outage', 'Partner returns feed paused during their maintenance window; no alert fired on our side.', 'T-BP-ACH', null,
      pir('Partner returns feed paused; our side had no freshness alert.', ['Customers learned of returns late.', 'Returns feed stopped.', 'Partner maintenance window.', 'No freshness alert on the returns feed.'], [['Freshness alert on partner returns feed', 'Ravi Menon', -20, true], ['Quarterly partner ops review covers maintenance notices', 'Ayo Ahmed', 10, false]], ago(28), anchor, 'INC-2207')),
    inc('INC-2209', 'Card freeze toggle did not persist on web', 'cards', 2, 24 * 24, 2, 5, 'Jonah Weiss', 57, 'Frozen cards showed active again after refresh; no unauthorised spend found.', 'release_regression', 'Optimistic UI update shipped without the server write on one code path.', null, null,
      pir('Freeze toggle skipped the server write on the web path.', ['Frozen cards appeared active.', 'Server never stored the freeze.'], [], null, anchor, 'INC-2209')),
    inc('INC-2211', 'Invoice capture dropped PO numbers on multi-page PDFs', 'billpay', 3, 15 * 24, 12, 40, 'Ravi Menon', 143, 'Bills lost PO numbers and failed 3-way match.', 'data_mapping', 'Extractor only read the first page header for the PO field.', 'T-BP-OCR', null, null),
    inc('INC-2212', 'Trip search slow at the 09:00 ET peak', 'travel', 4, 9 * 24, 1, 3, 'Wen Li', 0, 'Search took 6-9 seconds for about an hour.', 'capacity', 'Autoscaling floor too low for Monday morning traffic.', null, null, null),
    inc('INC-2213', 'Virtual card limit rounding on renewals', 'cards', 3, 6 * 24, 8, 22, 'Jonah Weiss', 41, 'Renewal limits rounded down to the nearest 100, causing small declines.', 'config_change', 'Rounding rule changed in the limits config without a migration for existing cards.', 'T-CARD-DECL', null,
      pir('Config change to rounding applied to existing cards.', ['Small renewal charges declined.', 'Limits were rounded down.', 'Rounding rule changed in config.', 'Config change had no migration plan.'], [['Config changes to limits need a migration note', 'Priya Raman', 7, false]], ago(4), anchor, 'INC-2213')),
    inc('INC-2214', 'Virtual card declines at SaaS merchants after MCC table refresh', 'cards', 2, 20, null, null, 'Jonah Weiss', 37, 'Virtual cards declining at software merchants (MCC 5734, 5817); 37 accounts so far.', null, null, 'T-CARD-DECL', 'LCH-303', null,
      [[1, 'Declines confirmed on MCC 5734/5817 after 13:00 ET table refresh.'], [6, 'Comparing refreshed MCC table against last known good.']]),
    inc('INC-2216', 'Approval reminders not sent to delegates', 'billpay', 3, 50, 6, null, 'Ravi Menon', 22, 'Delegated approvers in the beta did not get reminder emails.', null, null, 'T-BP-APPROVAL', 'LCH-302', null, [[6, 'Mitigated: reminders sent manually; fix in review.']]),
    inc('INC-2217', 'Hotel confirmation emails show UTC check-in times', 'travel', 4, 5, null, null, 'Wen Li', 9, 'Confirmation emails show check-in in UTC instead of hotel local time.', null, null, 'T-TR-HOTEL', null, null),
  ];
}

export function seedWorkspace(anchorMs: number): WorkspaceState {
  const anchor = Math.floor(anchorMs / HOUR) * HOUR;
  return {
    anchor: iso(anchor),
    feedback: buildFeedback(anchor),
    overrides: {},
    handoffs: {},
    launches: buildLaunches(anchor),
    incidents: buildIncidents(anchor),
    activity: [{ at: iso(anchor), kind: 'seed', text: 'Workspace created with synthetic sample data.' }],
    counters: { feedback: 1050, incident: 2217, receipt: 0, action: 0 },
  };
}

export const SEED_ACCOUNTS = ACCOUNTS;
