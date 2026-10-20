import { HOUR, DAY } from '../src/engine/util.ts';

export function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2).replace(/\.?0+$/, '')}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dateTime(isoStr: string): string {
  const d = new Date(isoStr);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
}
export function dateOnly(isoStr: string): string {
  const d = new Date(isoStr.length === 10 ? isoStr + 'T00:00:00Z' : isoStr);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
export function ago(isoStr: string, now: number): string {
  const ms = now - Date.parse(isoStr);
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / 60_000))}m ago`;
  if (ms < 2 * DAY) return `${Math.round(ms / HOUR)}h ago`;
  return `${Math.round(ms / DAY)}d ago`;
}
export function hours(h: number | null): string {
  if (h === null) return '—';
  if (h < 48) return `${h}h`;
  return `${Math.round((h / 24) * 10) / 10}d`;
}
export function plural(n: number, word: string, many = word + 's'): string {
  return `${n} ${n === 1 ? word : many}`;
}
export const CHANNEL_LABEL: Record<string, string> = {
  support_ticket: 'Support ticket', csm_call: 'CSM call', sales_call: 'Sales call', in_app: 'In-app', nps_comment: 'NPS comment', shared_slack: 'Shared channel',
};
export const SEGMENT_LABEL: Record<string, string> = { smb: 'SMB', mid_market: 'Mid-market', enterprise: 'Enterprise' };
