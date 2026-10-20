// Deterministic evals: seed goldens plus a held-out set of feedback written after the keyword lists were frozen.
import { buildVoice, evaluateLaunch, seedWorkspace, triage, type FeedbackItem, type ProductArea } from '../src/engine/index.ts';

const NOW = Date.parse('2026-10-20T08:00:00.000Z');
const s = seedWorkspace(NOW);
const base = s.feedback[0];
let failed = 0;
const check = (name: string, ok: boolean, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

const v = buildVoice(s);
check('seed has 40+ items', v.totals.items >= 40, `${v.totals.items}`);
check('every seed item has a rationale', v.triage.every((t) => t.rationale.length > 20));
const verdicts = Object.fromEntries(s.launches.map((l) => [l.id, evaluateLaunch(l, s.incidents, NOW)]));
check('LCH-301 ready (GO)', verdicts['LCH-301'].verdict === 'go');
check('LCH-302 mid-flight', verdicts['LCH-302'].phase === 'mid_flight');
check('LCH-303 blocked with reason', verdicts['LCH-303'].verdict === 'no_go' && verdicts['LCH-303'].blockers.length > 0);
const top = v.themes.find((t) => t.rank === 1)!;
check('top theme has 3+ distinct accounts', top.accounts >= 3, `${top.themeId} ${top.accounts} accounts`);

type Case = [string, ProductArea | null];
const HELD_OUT: Case[] = [
  ['Card was declined at our analytics vendor again on the annual renewal.', 'cards'],
  ['Can we raise the limit on the marketing card without opening a ticket?', 'cards'],
  ['The physical card for our Berlin hire still has not arrived, courier has no update.', 'cards'],
  ['I forwarded three receipts last week and they are still unmatched.', 'expenses'],
  ['Mileage for our Toronto team is paid per mile instead of per kilometre.', 'expenses'],
  ['Per diem for the Lisbon offsite got flagged even though it is within the meal allowance.', 'expenses'],
  ['Our approver is on leave and twelve bills are waiting on approval.', 'billpay'],
  ['The invoice capture misread the PO number and two line items.', 'billpay'],
  ['Vendor says the ACH never landed after they changed bank details.', 'billpay'],
  ['Flight got moved and the hotel would not let us rebook for the new dates.', 'travel'],
  ['The airline change fee never showed up in expenses.', 'travel'],
  ['Who approves a travel policy exception for business class on long-haul?', 'travel'],
  ['Honestly the product is great, keep it up.', null],
  ['Export to our ERP took ages yesterday.', null],
];
let right = 0, wrong = 0, abstained = 0;
for (const [i, [text, want]] of HELD_OUT.entries()) {
  const t = triage({ ...base, id: `FB-H${i}`, text } as FeedbackItem);
  const got = t.status === 'routed' ? t.area : null;
  if (got === want) right++;
  else if (got === null) abstained++;
  else wrong++;
  console.log(`  ${got === want ? 'ok   ' : got === null ? 'ABST ' : 'WRONG'} want=${want ?? 'person'} got=${got ?? t.status}  ${text}`);
}
console.log(`held-out: ${right}/${HELD_OUT.length} correct, ${abstained} sent to a person, ${wrong} wrong area`);
check('held-out wrong-area routes = 0', wrong === 0, `${wrong}`);
check('held-out accuracy >= 75%', right / HELD_OUT.length >= 0.75, `${Math.round((100 * right) / HELD_OUT.length)}%`);
console.log(failed ? `${failed} eval(s) failed` : 'all evals passed');
process.exit(failed ? 1 : 0);
