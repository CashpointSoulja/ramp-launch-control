import type { Theme } from './types.ts';

export const THEMES: readonly Theme[] = [
  { id: 'T-CARD-DECL', area: 'cards', title: 'Virtual card declines at SaaS merchants', keywords: [['declined', 3], ['decline', 3], ['declines', 3], ['virtual card', 2], ['saas', 1], ['mcc', 2], ['subscription', 1], ['renewal', 1]] },
  { id: 'T-CARD-LIMIT', area: 'cards', title: 'Slow card limit increase requests', keywords: [['limit increase', 4], ['raise the limit', 4], ['limit request', 3], ['spend limit', 2], ['card limit', 3]] },
  { id: 'T-CARD-SHIP', area: 'cards', title: 'Physical card delivery outside the US', keywords: [['physical card', 3], ['shipping', 2], ['delivery', 2], ['courier', 2], ['arrived', 1]] },
  { id: 'T-EXP-RCPT', area: 'expenses', title: 'Forwarded receipts not matching transactions', keywords: [['receipt', 2], ['receipts', 2], ['forwarded', 2], ['unmatched', 3], ['match', 1], ['missing receipt', 2]] },
  { id: 'T-EXP-MILE', area: 'expenses', title: 'Mileage rates for non-US teams', keywords: [['mileage', 4], ['per mile', 2], ['kilometre', 2], ['km', 1], ['hmrc', 2]] },
  { id: 'T-EXP-PERDIEM', area: 'expenses', title: 'Per diem flags on valid spend', keywords: [['per diem', 4], ['flagged', 1], ['out of policy', 1], ['meal allowance', 3]] },
  { id: 'T-BP-APPROVAL', area: 'billpay', title: 'Approval chains stall when an approver is out', keywords: [['approver', 3], ['approval chain', 3], ['out of office', 2], ['delegate', 2], ['stuck', 1], ['waiting on approval', 3]] },
  { id: 'T-BP-OCR', area: 'billpay', title: 'Invoice line items misread on capture', keywords: [['invoice', 2], ['line item', 3], ['line items', 3], ['misread', 3], ['po number', 2], ['extracted', 1]] },
  { id: 'T-BP-ACH', area: 'billpay', title: 'ACH payment timing and vendor bank changes', keywords: [['ach', 3], ['bank details', 3], ['remittance', 2], ['payment date', 2], ['vendor was paid', 2]] },
  { id: 'T-TR-HOTEL', area: 'travel', title: 'Hotel rebooking after a schedule change', keywords: [['hotel', 3], ['rebook', 3], ['rebooking', 3], ['schedule change', 2], ['check-in', 1]] },
  { id: 'T-TR-FLIGHT', area: 'travel', title: 'Flight change fees not reaching expenses', keywords: [['flight', 2], ['change fee', 4], ['airline', 2], ['fare difference', 3]] },
  { id: 'T-TR-POLICY', area: 'travel', title: 'Travel policy exception requests', keywords: [['travel policy', 4], ['business class', 3], ['exception', 1]] },
];

export const THEME_BY_ID: ReadonlyMap<string, Theme> = new Map(THEMES.map((t) => [t.id, t]));

export const ROUTE_THRESHOLD = 3;
export const AMBIGUITY_MARGIN = 2;
export const MIN_ACCOUNTS_TO_RANK = 3;
