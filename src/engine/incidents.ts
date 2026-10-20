import type { Incident, Pir, Severity } from './types.ts';
import { DAY, HOUR, median, parseIsoDate, parseIsoTimestamp } from './util.ts';

export const SLA_HOURS: Record<Severity, number> = { 1: 4, 2: 24, 3: 72, 4: 168 };
export const PIR_DUE_DAYS: Record<Severity, number | null> = { 1: 5, 2: 5, 3: 10, 4: null };
export const REPEAT_WINDOW_DAYS = 60;

export interface IncidentEval {
  incidentId: string;
  ageHours: number;
  ttmHours: number | null;
  ttrHours: number | null;
  slaHours: number;
  slaState: 'met' | 'breached' | 'at_risk' | 'on_track';
  pirState: 'not_required' | 'missing' | 'draft' | 'overdue' | 'complete';
  pirDue: string | null;
  repeatOf: string[];
}

const t = (s: string | null) => (s ? parseIsoTimestamp(s) : null);

export function evaluateIncident(inc: Incident, all: readonly Incident[], now: number): IncidentEval {
  const detected = t(inc.detectedAt)!;
  const resolved = t(inc.resolvedAt);
  const mitigated = t(inc.mitigatedAt);
  const ttrHours = resolved !== null ? round1((resolved - detected) / HOUR) : null;
  const ttmHours = mitigated !== null ? round1((mitigated - detected) / HOUR) : null;
  const ageHours = round1(((resolved ?? now) - detected) / HOUR);
  const slaHours = SLA_HOURS[inc.severity];
  const slaState = ttrHours !== null ? (ttrHours <= slaHours ? 'met' : 'breached') : ageHours > slaHours ? 'breached' : ageHours >= slaHours * 0.75 ? 'at_risk' : 'on_track';
  const dueDays = PIR_DUE_DAYS[inc.severity];
  let pirState: IncidentEval['pirState'] = 'not_required';
  let pirDue: string | null = null;
  if (dueDays !== null && resolved !== null) {
    const due = resolved + dueDays * DAY;
    pirDue = new Date(due).toISOString();
    if (inc.pir?.status === 'complete') pirState = 'complete';
    else if (now > due) pirState = 'overdue';
    else pirState = inc.pir ? 'draft' : 'missing';
  }
  const repeatOf = inc.rootCause
    ? all.filter((o) => o.id !== inc.id && o.area === inc.area && o.rootCause === inc.rootCause && t(o.detectedAt)! < detected && detected - t(o.detectedAt)! <= REPEAT_WINDOW_DAYS * DAY).map((o) => o.id)
    : [];
  return { incidentId: inc.id, ageHours, ttmHours, ttrHours, slaHours, slaState, pirState, pirDue, repeatOf };
}

export function pirProblems(p: Pick<Pir, 'summary' | 'whys' | 'actionItems'>): string[] {
  const out: string[] = [];
  if (p.summary.trim().length < 20) out.push('Summary needs at least 20 characters.');
  const whys = p.whys.filter((w) => w.trim().length >= 8);
  if (whys.length < 3) out.push(`Five Whys needs at least 3 answered whys (has ${whys.length}).`);
  if (p.actionItems.length < 1) out.push('At least one action item with an owner and due date is required.');
  for (const a of p.actionItems) {
    if (a.text.trim().length < 8 || a.owner.trim().length < 2 || parseIsoDate(a.due) === null) out.push(`Action item "${a.text.slice(0, 30)}" needs text, an owner and a valid due date.`);
  }
  return out;
}

export interface IncidentSummary {
  open: number;
  bySeverityOpen: Record<Severity, number>;
  medianTtr: Record<Severity, { hours: number | null; n: number }>;
  slaMet: { met: number; of: number };
  pirComplete: { complete: number; of: number };
  repeats: number;
}

export function summarizeIncidents(all: readonly Incident[], now: number): IncidentSummary {
  const evals = all.map((i) => [i, evaluateIncident(i, all, now)] as const);
  const sev: Severity[] = [1, 2, 3, 4];
  const medianTtr = Object.fromEntries(sev.map((s) => {
    const v = evals.filter(([i, e]) => i.severity === s && e.ttrHours !== null).map(([, e]) => e.ttrHours!);
    const m = median(v);
    return [s, { hours: m === null ? null : round1(m), n: v.length }];
  })) as IncidentSummary['medianTtr'];
  const resolved = evals.filter(([, e]) => e.ttrHours !== null);
  const required = evals.filter(([, e]) => e.pirState !== 'not_required');
  return {
    open: all.filter((i) => i.status !== 'resolved').length,
    bySeverityOpen: Object.fromEntries(sev.map((s) => [s, all.filter((i) => i.status !== 'resolved' && i.severity === s).length])) as Record<Severity, number>,
    medianTtr,
    slaMet: { met: resolved.filter(([, e]) => e.slaState === 'met').length, of: resolved.length },
    pirComplete: { complete: required.filter(([, e]) => e.pirState === 'complete').length, of: required.length },
    repeats: evals.filter(([, e]) => e.repeatOf.length > 0).length,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
