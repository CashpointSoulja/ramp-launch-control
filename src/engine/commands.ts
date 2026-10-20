import { THEME_BY_ID, MIN_ACCOUNTS_TO_RANK } from './themes.ts';
import { validateImport } from './csv.ts';
import { evaluateLaunch } from './launch.ts';
import { pirProblems } from './incidents.ts';
import { buildVoice } from './voice.ts';
import { AREA_INFO, ITEM_STATUSES, PRODUCT_AREAS, ROOT_CAUSES, ROOT_CAUSE_LABEL, SIGNOFF_ROLES, type ActionItem, type Incident, type ItemStatus, type ProductArea, type RootCause, type Severity, type SignoffRole, type WorkspaceState } from './types.ts';
import { cleanText, iso, parseIsoDate } from './util.ts';

export class CommandError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const bad = (msg: string, code = 'invalid_command') => new CommandError(422, code, msg);

type FieldType = 'string' | 'number' | 'boolean' | 'string[]' | 'actions';
type Spec = Record<string, [FieldType, boolean]>;
const SPECS: Record<string, Spec> = {
  import_feedback: { csv: ['string', true] },
  override_route: { feedbackId: ['string', true], themeId: ['string', true], note: ['string', true] },
  clear_override: { feedbackId: ['string', true] },
  handoff_theme: { themeId: ['string', true] },
  set_item: { launchId: ['string', true], itemId: ['string', true], status: ['string', true], evidence: ['string', false], blockedReason: ['string', false] },
  sign_off: { launchId: ['string', true], role: ['string', true] },
  record_decision: { launchId: ['string', true], verdict: ['string', true], note: ['string', true] },
  declare_incident: { title: ['string', true], area: ['string', true], severity: ['number', true], commander: ['string', true], accountsAffected: ['number', true], customerImpact: ['string', true], linkedThemeId: ['string', false] },
  post_update: { incidentId: ['string', true], text: ['string', true] },
  set_severity: { incidentId: ['string', true], severity: ['number', true], reason: ['string', true] },
  mitigate: { incidentId: ['string', true], note: ['string', true] },
  resolve: { incidentId: ['string', true], rootCause: ['string', true], rootCauseNote: ['string', true] },
  save_pir: { incidentId: ['string', true], summary: ['string', true], whys: ['string[]', true], actionItems: ['actions', true] },
  complete_pir: { incidentId: ['string', true] },
  toggle_action: { incidentId: ['string', true], actionId: ['string', true], done: ['boolean', true] },
  reset: {},
};
export const COMMAND_TYPES = Object.keys(SPECS);

export type Command = { type: string } & Record<string, unknown>;

export function parseCommand(raw: unknown): Command {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new CommandError(400, 'bad_request', 'Command must be a JSON object.');
  const obj = raw as Record<string, unknown>;
  const type = obj.type;
  if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(SPECS, type)) throw new CommandError(400, 'unknown_command', 'Unknown command type.');
  const spec = SPECS[type];
  for (const k of Object.keys(obj)) if (k !== 'type' && !Object.prototype.hasOwnProperty.call(spec, k)) throw new CommandError(400, 'unknown_field', `Unknown field "${k}" for ${type}.`);
  for (const [k, [ft, required]] of Object.entries(spec)) {
    const v = obj[k];
    if (v === undefined || v === null) {
      if (required) throw new CommandError(400, 'missing_field', `Missing field "${k}".`);
      continue;
    }
    const ok = ft === 'string' ? typeof v === 'string' && v.length <= 60_000
      : ft === 'number' ? typeof v === 'number' && Number.isFinite(v)
      : ft === 'boolean' ? typeof v === 'boolean'
      : ft === 'string[]' ? Array.isArray(v) && v.length <= 7 && v.every((x) => typeof x === 'string' && x.length <= 400)
      : Array.isArray(v) && v.length <= 10 && v.every((a) => a && typeof a === 'object' && !Array.isArray(a) && Object.keys(a).every((kk) => ['text', 'owner', 'due'].includes(kk)) && typeof a.text === 'string' && typeof a.owner === 'string' && typeof a.due === 'string');
    if (!ok) throw new CommandError(400, 'bad_field', `Field "${k}" has the wrong type.`);
  }
  return obj as Command;
}

const str = (c: Command, k: string) => c[k] as string;
const req = (v: unknown, min: number, max: number, label: string): string => {
  const t = cleanText(v, min, max);
  if (t === null) throw bad(`${label} must be ${min}-${max} characters.`);
  return t;
};

function log(s: WorkspaceState, now: number, kind: string, text: string) {
  s.activity.unshift({ at: iso(now), kind, text });
  if (s.activity.length > 200) s.activity.length = 200;
}
function findLaunch(s: WorkspaceState, id: string) {
  const l = s.launches.find((x) => x.id === id);
  if (!l) throw new CommandError(404, 'not_found', `Launch ${id} not found.`);
  return l;
}
function findIncident(s: WorkspaceState, id: string): Incident {
  const i = s.incidents.find((x) => x.id === id);
  if (!i) throw new CommandError(404, 'not_found', `Incident ${id} not found.`);
  return i;
}
const sev = (v: unknown): Severity => {
  if (v !== 1 && v !== 2 && v !== 3 && v !== 4) throw bad('Severity must be 1, 2, 3 or 4.');
  return v;
};

export type CommandResult = Record<string, unknown> & { message: string };

/** Applies a validated command to a deep copy of state. Throws CommandError and leaves state untouched on refusal. */
export function applyCommand(prev: WorkspaceState, cmd: Command, now: number): { state: WorkspaceState; result: CommandResult } {
  const s: WorkspaceState = structuredClone(prev);
  const result = run(s, cmd, now);
  return { state: s, result };
}

function run(s: WorkspaceState, c: Command, now: number): CommandResult {
  switch (c.type) {
    case 'import_feedback': {
      const check = validateImport(str(c, 'csv'), new Set(s.feedback.map((f) => f.id)), now);
      if (check.errors.length) throw new CommandError(422, 'import_rejected', `Import rejected, nothing was added. ${check.errors.slice(0, 8).join(' ')}${check.errors.length > 8 ? ` (+${check.errors.length - 8} more)` : ''}`);
      s.feedback.push(...check.items);
      log(s, now, 'voice', `Imported ${check.items.length} feedback item(s) for triage.`);
      return { message: `Imported ${check.items.length} item(s); the agent triaged them on arrival.`, imported: check.items.map((i) => i.id) };
    }
    case 'override_route': {
      const f = s.feedback.find((x) => x.id === str(c, 'feedbackId'));
      if (!f) throw new CommandError(404, 'not_found', 'Feedback item not found.');
      const theme = THEME_BY_ID.get(str(c, 'themeId'));
      if (!theme) throw bad('Unknown theme.');
      if (f.text.trim().length < 12) throw bad('This item was rejected as too short; it cannot be routed.');
      const note = req(c.note, 8, 280, 'Routing note');
      s.overrides[f.id] = { themeId: theme.id, note, at: iso(now) };
      log(s, now, 'voice', `${f.id} routed by a person to ${AREA_INFO[theme.area].label}: ${theme.title}.`);
      return { message: `${f.id} routed to ${AREA_INFO[theme.area].label}.` };
    }
    case 'clear_override': {
      const id = str(c, 'feedbackId');
      if (!s.overrides[id]) throw new CommandError(409, 'no_override', 'That item has no manual routing to clear.');
      delete s.overrides[id];
      log(s, now, 'voice', `${id} returned to the agent's routing.`);
      return { message: `${id} returned to the agent's routing.` };
    }
    case 'handoff_theme': {
      const voice = buildVoice(s);
      const t = voice.themes.find((x) => x.themeId === str(c, 'themeId'));
      if (!t) throw new CommandError(404, 'not_found', 'Theme not found.');
      if (t.accounts < MIN_ACCOUNTS_TO_RANK) throw bad(`Not handed off: ${t.accounts} account(s) is under the ${MIN_ACCOUNTS_TO_RANK}-account bar for a product brief.`, 'below_threshold');
      if (t.handoff === 'current') throw new CommandError(409, 'already_handed_off', 'This theme was already handed off and nothing has changed since.');
      s.counters.receipt += 1;
      const receiptId = `HND-${String(s.counters.receipt).padStart(4, '0')}`;
      s.handoffs[t.themeId] = { themeId: t.themeId, area: t.area, at: iso(now), fingerprint: t.fingerprint, receiptId, accounts: t.accounts, arrUsd: t.arrUsd, feedbackIds: t.feedbackIds };
      log(s, now, 'voice', `${receiptId}: "${t.title}" brief logged for ${AREA_INFO[t.area].label} (${t.accounts} accounts).`);
      return { message: `Brief ${receiptId} logged for ${AREA_INFO[t.area].owner} (${AREA_INFO[t.area].label}). Logged in this workspace only.`, receiptId };
    }
    case 'set_item': {
      const l = findLaunch(s, str(c, 'launchId'));
      const it = l.items.find((x) => x.id === str(c, 'itemId'));
      if (!it) throw new CommandError(404, 'not_found', 'Checklist item not found.');
      const status = str(c, 'status') as ItemStatus;
      if (!ITEM_STATUSES.includes(status)) throw bad('Unknown checklist status.');
      if (status === 'done') {
        it.evidence = req(c.evidence, 4, 160, 'Evidence (a link, doc name or run ID)');
        it.blockedReason = null;
      } else if (status === 'blocked') {
        it.blockedReason = req(c.blockedReason, 8, 200, 'Blocked reason');
        it.evidence = null;
      } else {
        if (c.evidence !== undefined || c.blockedReason !== undefined) throw bad('Evidence and blocked reason only apply to done and blocked.');
        it.evidence = null;
        it.blockedReason = null;
      }
      if (it.status === status && status !== 'done' && status !== 'blocked') throw new CommandError(409, 'no_change', 'Item already has that status.');
      it.status = status;
      log(s, now, 'launch', `${l.id} · ${it.label}: ${status.replace('_', ' ')}.`);
      return { message: `${it.label}: ${status.replace('_', ' ')}. Sign-offs given before this change are now stale.` };
    }
    case 'sign_off': {
      const l = findLaunch(s, str(c, 'launchId'));
      const role = str(c, 'role') as SignoffRole;
      if (!SIGNOFF_ROLES.includes(role)) throw bad('Unknown sign-off role.');
      const ev = evaluateLaunch(l, s.incidents, now);
      if (ev.blockers.length) throw bad(`Cannot sign off while blocked: ${ev.blockers[0]}`, 'blocked');
      if (ev.critical.done < ev.critical.total) throw bad(`Cannot sign off with ${ev.critical.total - ev.critical.done} critical item(s) open.`, 'not_ready');
      const existing = ev.signoffs.find((x) => x.role === role)!;
      if (existing.state === 'current') throw new CommandError(409, 'already_signed', 'Already signed off on this exact checklist.');
      l.signoffs = l.signoffs.filter((x) => x.role !== role).concat({ role, name: l.people[role], at: iso(now), fingerprint: ev.fingerprint });
      log(s, now, 'launch', `${l.id} signed off by ${l.people[role]}.`);
      return { message: `Signed off by ${l.people[role]} on checklist ${ev.fingerprint.slice(0, 8)}.` };
    }
    case 'record_decision': {
      const l = findLaunch(s, str(c, 'launchId'));
      const verdict = str(c, 'verdict');
      if (verdict !== 'go' && verdict !== 'no_go') throw bad('Verdict must be go or no_go.');
      const note = req(c.note, 8, 280, 'Decision note');
      const ev = evaluateLaunch(l, s.incidents, now);
      if (verdict === 'go' && ev.verdict !== 'go') throw bad(`GO refused: ${[...ev.blockers, ...ev.holds][0]}`, 'gate_closed');
      l.decision = { verdict, at: iso(now), fingerprint: ev.fingerprint, note };
      log(s, now, 'launch', `${l.id} decision: ${verdict === 'go' ? 'GO' : 'NO-GO'}.`);
      return { message: `${verdict === 'go' ? 'GO' : 'NO-GO'} recorded for ${l.name}.` };
    }
    case 'declare_incident': {
      const area = str(c, 'area') as ProductArea;
      if (!PRODUCT_AREAS.includes(area)) throw bad('Unknown product area.');
      const accounts = c.accountsAffected as number;
      if (!Number.isInteger(accounts) || accounts < 0 || accounts > 1_000_000) throw bad('Accounts affected must be a whole number.');
      const theme = c.linkedThemeId === undefined || c.linkedThemeId === '' ? null : str(c, 'linkedThemeId');
      if (theme !== null && !THEME_BY_ID.has(theme)) throw bad('Unknown linked theme.');
      s.counters.incident += 1;
      const inc: Incident = {
        id: `INC-${s.counters.incident}`, title: req(c.title, 8, 120, 'Title'), area, severity: sev(c.severity), status: 'investigating',
        detectedAt: iso(now), mitigatedAt: null, resolvedAt: null, commander: req(c.commander, 2, 60, 'Commander'), accountsAffected: accounts,
        customerImpact: req(c.customerImpact, 12, 400, 'Customer impact'), rootCause: null, rootCauseNote: null, linkedThemeId: theme, linkedLaunchId: null,
        updates: [{ at: iso(now), text: 'Incident declared.' }], pir: null,
      };
      s.incidents.push(inc);
      log(s, now, 'incident', `${inc.id} declared, SEV-${inc.severity} in ${AREA_INFO[area].label}.`);
      return { message: `${inc.id} declared at SEV-${inc.severity}.`, incidentId: inc.id };
    }
    case 'post_update': {
      const inc = findIncident(s, str(c, 'incidentId'));
      if (inc.status === 'resolved') throw new CommandError(409, 'resolved', 'Incident is resolved; add follow-ups to the post-incident review.');
      inc.updates.push({ at: iso(now), text: req(c.text, 4, 400, 'Update') });
      log(s, now, 'incident', `${inc.id} update posted.`);
      return { message: 'Update posted to the incident timeline.' };
    }
    case 'set_severity': {
      const inc = findIncident(s, str(c, 'incidentId'));
      if (inc.status === 'resolved') throw new CommandError(409, 'resolved', 'Severity is fixed once resolved.');
      const next = sev(c.severity);
      if (next === inc.severity) throw new CommandError(409, 'no_change', 'Severity unchanged.');
      const reason = req(c.reason, 8, 200, 'Reason');
      inc.updates.push({ at: iso(now), text: `Severity SEV-${inc.severity} → SEV-${next}: ${reason}` });
      inc.severity = next;
      log(s, now, 'incident', `${inc.id} moved to SEV-${next}.`);
      return { message: `${inc.id} is now SEV-${next}.` };
    }
    case 'mitigate': {
      const inc = findIncident(s, str(c, 'incidentId'));
      if (inc.status !== 'investigating') throw new CommandError(409, 'bad_transition', `Only investigating incidents can be mitigated (this one is ${inc.status}).`);
      inc.status = 'mitigated';
      inc.mitigatedAt = iso(now);
      inc.updates.push({ at: iso(now), text: `Mitigated: ${req(c.note, 8, 400, 'Mitigation note')}` });
      log(s, now, 'incident', `${inc.id} mitigated.`);
      return { message: `${inc.id} mitigated.` };
    }
    case 'resolve': {
      const inc = findIncident(s, str(c, 'incidentId'));
      if (inc.status === 'resolved') throw new CommandError(409, 'bad_transition', 'Already resolved.');
      const rc = str(c, 'rootCause') as RootCause;
      if (!ROOT_CAUSES.includes(rc)) throw bad('Pick a root-cause category before resolving.');
      inc.rootCause = rc;
      inc.rootCauseNote = req(c.rootCauseNote, 20, 400, 'Root-cause note');
      inc.status = 'resolved';
      if (!inc.mitigatedAt) inc.mitigatedAt = iso(now);
      inc.resolvedAt = iso(now);
      inc.updates.push({ at: iso(now), text: `Resolved. Root cause: ${ROOT_CAUSE_LABEL[rc]}.` });
      log(s, now, 'incident', `${inc.id} resolved (${ROOT_CAUSE_LABEL[rc]}).`);
      return { message: `${inc.id} resolved.${inc.severity <= 3 ? ' A post-incident review is now due.' : ''}` };
    }
    case 'save_pir': {
      const inc = findIncident(s, str(c, 'incidentId'));
      if (inc.status !== 'resolved') throw new CommandError(409, 'not_resolved', 'Post-incident reviews open once the incident is resolved.');
      if (inc.pir?.status === 'complete') throw new CommandError(409, 'pir_complete', 'This review is complete and locked.');
      const whys = (c.whys as string[]).map((w) => w.replace(/\s+/g, ' ').trim()).filter(Boolean);
      const raw = c.actionItems as Array<{ text: string; owner: string; due: string }>;
      const actionItems: ActionItem[] = raw.map((a, i) => {
        if (parseIsoDate(a.due) === null) throw bad(`Action ${i + 1}: due date must be YYYY-MM-DD.`);
        return { id: `${inc.id}-A${i + 1}`, text: req(a.text, 8, 200, `Action ${i + 1} text`), owner: req(a.owner, 2, 60, `Action ${i + 1} owner`), due: a.due, done: inc.pir?.actionItems[i]?.done ?? false };
      });
      inc.pir = { status: 'draft', summary: req(c.summary, 1, 600, 'Summary'), whys, actionItems, completedAt: null };
      log(s, now, 'incident', `${inc.id} review draft saved.`);
      return { message: 'Review draft saved.', problems: pirProblems(inc.pir) };
    }
    case 'complete_pir': {
      const inc = findIncident(s, str(c, 'incidentId'));
      if (!inc.pir) throw new CommandError(409, 'no_pir', 'Save a review draft first.');
      if (inc.pir.status === 'complete') throw new CommandError(409, 'pir_complete', 'Already complete.');
      const problems = pirProblems(inc.pir);
      if (!inc.rootCause) problems.unshift('Incident has no root-cause category.');
      if (problems.length) throw bad(`Review not complete: ${problems.join(' ')}`, 'pir_incomplete');
      inc.pir.status = 'complete';
      inc.pir.completedAt = iso(now);
      log(s, now, 'incident', `${inc.id} post-incident review completed.`);
      return { message: 'Post-incident review completed.' };
    }
    case 'toggle_action': {
      const inc = findIncident(s, str(c, 'incidentId'));
      const a = inc.pir?.actionItems.find((x) => x.id === str(c, 'actionId'));
      if (!a) throw new CommandError(404, 'not_found', 'Action item not found.');
      if (a.done === c.done) throw new CommandError(409, 'no_change', 'No change.');
      a.done = c.done as boolean;
      log(s, now, 'incident', `${a.id} marked ${a.done ? 'done' : 'open'}.`);
      return { message: `Action ${a.done ? 'done' : 'reopened'}.` };
    }
    default:
      throw new CommandError(400, 'unknown_command', 'Unknown command type.');
  }
}
