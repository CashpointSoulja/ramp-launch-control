import { describe, expect, it } from 'vitest';
import {
  applyCommand, buildVoice, CommandError, evaluateIncident, evaluateLaunch, execute, freshEnvelope, parseCommand,
  pirProblems, seedWorkspace, themeScore, triage, validateImport, CSV_HEADER, type FeedbackItem, type WorkspaceState,
} from '../src/engine/index.ts';

const NOW = Date.parse('2026-10-20T08:00:00.000Z');
const seed = () => seedWorkspace(NOW);
const item = (text: string, id = 'FB-9001'): FeedbackItem => ({ ...seed().feedback[0], id, text });
const act = (s: WorkspaceState, cmd: Record<string, unknown>) => applyCommand(s, parseCommand(cmd), NOW);
const refused = (s: WorkspaceState, cmd: Record<string, unknown>) => {
  try { act(s, cmd); } catch (e) { if (e instanceof CommandError) return e; throw e; }
  throw new Error('expected refusal');
};

describe('seed', () => {
  it('has 40+ feedback items across all four areas', () => {
    const s = seed();
    expect(s.feedback.length).toBeGreaterThanOrEqual(40);
    const areas = new Set(buildVoice(s).triage.map((t) => t.area).filter(Boolean));
    expect([...areas].sort()).toEqual(['billpay', 'cards', 'expenses', 'travel']);
  });
  it('shows one launch ready, one mid-flight and one blocked with a reason', () => {
    const s = seed();
    const ev = Object.fromEntries(s.launches.map((l) => [l.id, evaluateLaunch(l, s.incidents, NOW)]));
    expect(ev['LCH-301'].verdict).toBe('go');
    expect(ev['LCH-302'].phase).toBe('mid_flight');
    expect(ev['LCH-303'].verdict).toBe('no_go');
    expect(ev['LCH-303'].blockers.join(' ')).toMatch(/INC-2214/);
  });
  it('gives every resolved SEV-1..3 incident a review state', () => {
    const s = seed();
    for (const i of s.incidents.filter((x) => x.status === 'resolved' && x.severity <= 3)) {
      expect(['complete', 'draft', 'missing', 'overdue']).toContain(evaluateIncident(i, s.incidents, NOW).pirState);
    }
  });
});

describe('triage agent', () => {
  it('routes a clear item with a written rationale', () => {
    const t = triage(item('Our virtual card keeps getting declined on SaaS renewals.'));
    expect(t.status).toBe('routed');
    expect(t.themeId).toBe('T-CARD-DECL');
    expect(t.rationale).toMatch(/Routed to Cards/);
    expect(t.rationale).toMatch(/declined/);
  });
  it('rejects text too short to triage', () => {
    expect(triage(item('broken??')).status).toBe('rejected');
  });
  it('does not guess below the threshold', () => {
    const t = triage(item('The new dashboard feels a little slow this week.'));
    expect(t.status).toBe('needs_human');
    expect(t.area).toBeNull();
  });
  it('sends close cross-area calls to a person', () => {
    const t = triage(item('The hotel invoice was misread and we could not rebook.'));
    expect(t.status).toBe('needs_human');
    expect(t.rationale).toMatch(/person/i);
  });
  it('honours a human override', () => {
    const t = triage(item('Something odd happened'), { themeId: 'T-BP-ACH', note: 'Confirmed on call', at: new Date(NOW).toISOString() });
    expect(t).toMatchObject({ status: 'routed', by: 'human', area: 'billpay' });
  });
});

describe('scoring', () => {
  it('is distinct accounts × ARR in $M', () => {
    expect(themeScore(7, 7_620_000)).toBe(53.3);
  });
  it('keeps a one-account theme on watch however loud', () => {
    const mile = buildVoice(seed()).themes.find((t) => t.themeId === 'T-EXP-MILE')!;
    expect(mile.mentions).toBeGreaterThan(mile.accounts);
    expect(mile.rank).toBeNull();
  });
});

describe('launch gates', () => {
  it('refuses done without evidence and blocked without a reason', () => {
    const s = seed();
    const l = s.launches.find((x) => x.id === 'LCH-302')!;
    const it0 = l.items.find((i) => i.status !== 'done')!;
    expect(refused(s, { type: 'set_item', launchId: l.id, itemId: it0.id, status: 'done' }).status).toBe(422);
    expect(refused(s, { type: 'set_item', launchId: l.id, itemId: it0.id, status: 'blocked' }).status).toBe(422);
  });
  it('makes sign-offs stale when the checklist changes', () => {
    const s = seed();
    const l = s.launches.find((x) => x.id === 'LCH-301')!;
    const target = l.items[0];
    const { state } = act(s, { type: 'set_item', launchId: l.id, itemId: target.id, status: 'in_progress' });
    const ev = evaluateLaunch(state.launches.find((x) => x.id === l.id)!, state.incidents, NOW);
    expect(ev.verdict).not.toBe('go');
    expect(ev.signoffs.some((x) => x.state === 'stale')).toBe(true);
  });
  it('refuses a GO decision while the gate says NO-GO', () => {
    const e = refused(seed(), { type: 'record_decision', launchId: 'LCH-303', verdict: 'go', note: 'Ship it anyway' });
    expect([e.status, e.code]).toEqual([422, 'gate_closed']);
  });
});

describe('incidents', () => {
  it('needs a root cause to resolve', () => {
    expect(refused(seed(), { type: 'resolve', incidentId: 'INC-2214', rootCause: '', rootCauseNote: 'x' }).status).toBe(422);
  });
  it('resolving the SEV-2 lifts its launch block', () => {
    const { state } = act(seed(), { type: 'resolve', incidentId: 'INC-2214', rootCause: 'config_change', rootCauseNote: 'MCC table refresh dropped SaaS merchant codes from the allowlist.' });
    const ev = evaluateLaunch(state.launches.find((x) => x.id === 'LCH-303')!, state.incidents, NOW);
    expect(ev.blockers.join(' ')).not.toMatch(/INC-2214 \(SEV-2\)/);
  });
  it('lists what a review is missing', () => {
    expect(pirProblems({ summary: 'short', whys: ['a'], actionItems: [] }).length).toBeGreaterThanOrEqual(3);
  });
});

describe('csv import', () => {
  const row = (id: string, at = '2026-10-19T10:00:00Z') => `${id},${at},support_ticket,ACC-9001,Northwind Labs,smb,120000,"Receipts forwarded by email never match the card transaction."`;
  it('accepts a valid file', () => {
    const r = validateImport(`${CSV_HEADER}\n${row('FB-9001')}`, new Set(), NOW);
    expect(r.errors).toEqual([]);
    expect(r.items).toHaveLength(1);
  });
  it('rejects the whole file when one row is bad', () => {
    const r = validateImport(`${CSV_HEADER}\n${row('FB-9001')}\n${row('FB-9002', '2027-01-01T00:00:00Z')}`, new Set(), NOW);
    expect(r.items).toEqual([]);
    expect(r.errors.join(' ')).toMatch(/future/i);
  });
  it('rejects duplicates of existing IDs', () => {
    expect(validateImport(`${CSV_HEADER}\n${row('FB-1001')}`, new Set(['FB-1001']), NOW).errors.length).toBe(1);
  });
});

describe('workspace', () => {
  const req = (command: unknown, idempotencyKey: string, expectedRevision: number) => ({ command, idempotencyKey, expectedRevision });
  const sign = { type: 'post_update', incidentId: 'INC-2217', text: 'Template fix in review.' };
  it('replays an idempotent retry without a second write', () => {
    const a = execute(freshEnvelope(NOW), req(sign, 'key-00000001', 1), NOW);
    const b = execute(a.envelope, req(sign, 'key-00000001', 1), NOW);
    expect(b.response).toMatchObject({ ok: true, replayed: true, revision: 2 });
  });
  it('refuses a reused key for a different command', () => {
    const a = execute(freshEnvelope(NOW), req(sign, 'key-00000001', 1), NOW);
    expect(execute(a.envelope, req({ ...sign, text: 'Different update text.' }, 'key-00000001', 2), NOW).response).toMatchObject({ ok: false, code: 'key_reused' });
  });
  it('refuses a stale revision', () => {
    expect(execute(freshEnvelope(NOW), req(sign, 'key-00000002', 7), NOW).response).toMatchObject({ ok: false, status: 409, code: 'stale_revision' });
  });
  it('reset bumps the epoch so old keys apply again', () => {
    const a = execute(freshEnvelope(NOW), req(sign, 'key-00000003', 1), NOW);
    const r = execute(a.envelope, req({ type: 'reset' }, 'key-reset-01', 2), NOW);
    expect(r.envelope.epoch).toBe(2);
    expect(execute(r.envelope, req(sign, 'key-00000003', 3), NOW).response).toMatchObject({ ok: true, replayed: false });
  });
  it('refuses unknown commands and fields', () => {
    expect(() => parseCommand({ type: 'drop_tables' })).toThrow(CommandError);
    expect(() => parseCommand({ ...sign, extra: 1 })).toThrow(CommandError);
  });
});
