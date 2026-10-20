import { AREA_INFO, SIGNOFF_ROLES, type Incident, type Launch, type SignoffRole } from './types.ts';
import { DAY, fnv1a, parseIsoDate, stableStringify } from './util.ts';

export const ENABLEMENT_LEAD_DAYS = 2;

export function launchFingerprint(l: Pick<Launch, 'stage' | 'targetDate' | 'items'>): string {
  return fnv1a(stableStringify({ stage: l.stage, target: l.targetDate, items: l.items.map((i) => [i.id, i.status, i.evidence, i.blockedReason, i.critical]) }));
}

export type Verdict = 'go' | 'hold' | 'no_go';
export interface SignoffView { role: SignoffRole; name: string; state: 'current' | 'stale' | 'missing'; at: string | null }
export interface LaunchEval {
  launchId: string;
  verdict: Verdict;
  phase: 'ready' | 'mid_flight' | 'blocked' | 'early';
  blockers: string[];
  holds: string[];
  enablement: { done: number; total: number };
  support: { done: number; total: number };
  critical: { done: number; total: number };
  overall: { done: number; total: number };
  signoffs: SignoffView[];
  fingerprint: string;
  daysToTarget: number;
  decisionState: 'none' | 'current' | 'stale';
}

const isDone = (i: Launch['items'][number]) => i.status === 'done' && !!i.evidence && i.evidence.trim().length > 0;

export function evaluateLaunch(l: Launch, incidents: readonly Incident[], now: number): LaunchEval {
  const fp = launchFingerprint(l);
  const target = parseIsoDate(l.targetDate) ?? now;
  const daysToTarget = Math.ceil((target - now) / DAY);
  const count = (pred: (i: Launch['items'][number]) => boolean) => {
    const set = l.items.filter(pred);
    return { done: set.filter(isDone).length, total: set.length };
  };
  const enablement = count((i) => i.category === 'enablement');
  const support = count((i) => i.category === 'support');
  const critical = count((i) => i.critical);
  const overall = count(() => true);
  const blockers: string[] = [];
  const holds: string[] = [];

  if (l.items.length === 0) blockers.push('No checklist items: there is nothing to evaluate, so the gate stays closed.');
  for (const i of l.items) {
    if (i.critical && i.status === 'blocked') blockers.push(`"${i.label}" is blocked: ${i.blockedReason ?? 'no reason recorded'}`);
    if (i.status === 'done' && !isDone(i)) holds.push(`"${i.label}" is marked done without evidence.`);
  }
  for (const inc of incidents) {
    if (inc.status === 'resolved' || inc.severity > 2) continue;
    if (inc.area === l.area || inc.linkedLaunchId === l.id) {
      blockers.push(`${inc.id} (SEV-${inc.severity}) is open in ${AREA_INFO[inc.area].label}: ${inc.title}.`);
    }
  }
  const openCritical = l.items.filter((i) => i.critical && !isDone(i) && i.status !== 'blocked');
  if (daysToTarget < 0 && critical.done < critical.total) blockers.push(`Target date ${l.targetDate} has passed with ${critical.total - critical.done} critical items open.`);
  const enablementOpen = l.items.filter((i) => i.category === 'enablement' && i.critical && !isDone(i));
  if (enablementOpen.length > 0 && daysToTarget < ENABLEMENT_LEAD_DAYS && daysToTarget >= 0) {
    blockers.push(`Enablement lands late: ${enablementOpen.length} enablement item(s) open with ${daysToTarget} day(s) to target; enablement must be done ${ENABLEMENT_LEAD_DAYS} days before launch.`);
  }
  if (openCritical.length > 0) holds.push(`${openCritical.length} critical item(s) not done: ${openCritical.map((i) => i.label).join('; ')}.`);

  const signoffs: SignoffView[] = SIGNOFF_ROLES.map((role) => {
    const s = l.signoffs.find((x) => x.role === role);
    return { role, name: l.people[role], state: !s ? 'missing' : s.fingerprint === fp ? 'current' : 'stale', at: s?.at ?? null };
  });
  const missing = signoffs.filter((s) => s.state !== 'current');
  if (missing.length > 0) holds.push(`Sign-off needed from ${missing.map((s) => `${roleLabel(s.role)}${s.state === 'stale' ? ' (stale: checklist changed after sign-off)' : ''}`).join(', ')}.`);

  const verdict: Verdict = blockers.length > 0 ? 'no_go' : holds.length > 0 ? 'hold' : 'go';
  const phase = verdict === 'no_go' ? 'blocked' : verdict === 'go' ? 'ready' : overall.done === 0 || overall.done / Math.max(1, overall.total) < 0.25 ? 'early' : 'mid_flight';
  const decisionState = !l.decision ? 'none' : l.decision.fingerprint === fp ? 'current' : 'stale';
  return { launchId: l.id, verdict, phase, blockers, holds, enablement, support, critical, overall, signoffs, fingerprint: fp, daysToTarget, decisionState };
}

export function roleLabel(r: SignoffRole): string {
  return { pm: 'Product', eng: 'Engineering', support: 'Support', prodops: 'Product Ops' }[r];
}
