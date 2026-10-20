import { useState } from 'react';
import { AREA_INFO, PRODUCT_AREAS, ROOT_CAUSES, ROOT_CAUSE_LABEL, type Incident, type Severity } from '../src/engine/types.ts';
import { THEMES, THEME_BY_ID } from '../src/engine/themes.ts';
import { SLA_HOURS, pirProblems } from '../src/engine/incidents.ts';
import { Chip, Drawer, PageHead, SevChip, StatusChip, Tabs, type Ctx, type Tone } from './ui.tsx';
import { dateTime, hours, plural } from './format.ts';

type Tab = 'open' | 'resolved' | 'all';
const SLA_TONE: Record<string, [Tone, string]> = { met: ['pos', 'Within SLA'], breached: ['neg', 'SLA breached'], at_risk: ['cau', 'SLA at risk'], on_track: ['neu', 'On track'] };
const PIR_TONE: Record<string, [Tone, string]> = { not_required: ['neu', 'Not required'], missing: ['cau', 'Review due'], draft: ['cau', 'Draft'], overdue: ['neg', 'Overdue'], complete: ['pos', 'Complete'] };

export function IncidentsPage({ ctx, id }: { ctx: Ctx; id?: string }) {
  const [tab, setTab] = useState<Tab>('open');
  const [declaring, setDeclaring] = useState(false);
  const inc = id ? ctx.state.incidents.find((i) => i.id === id) : undefined;
  if (id && !inc) return <><h1>Incident not found</h1><p><a href="#/incidents">Back to incidents</a></p></>;
  if (inc) return <IncidentDetail ctx={ctx} inc={inc} />;
  const s = ctx.incidentSummary;
  const all = [...ctx.state.incidents].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
  const open = all.filter((i) => i.status !== 'resolved');
  const resolved = all.filter((i) => i.status === 'resolved');
  const rows = tab === 'open' ? open : tab === 'resolved' ? resolved : all;
  const overdue = Object.values(ctx.incidentEval).filter((e) => e.pirState === 'overdue').length;
  const sevs: Severity[] = [1, 2, 3, 4];
  return (
    <>
      <PageHead crumb={<><a href="#/">Launch Control</a> / Incidents</>} title="Incident board" count={`${s.open} open · ${resolved.length} resolved`}
        actions={<button type="button" className="btn primary" onClick={() => setDeclaring(true)}>Declare incident</button>} />
      <div className="kpis">
        <div className="kpi"><div className="label">Open now</div><div className="value">{s.open}</div><div className="note">{sevs.filter((v) => s.bySeverityOpen[v]).map((v) => `SEV-${v} ${s.bySeverityOpen[v]}`).join(' · ') || 'None'}</div></div>
        <div className="kpi"><div className="label">Median time to resolve, SEV-2</div><div className="value">{hours(s.medianTtr[2].hours)}</div><div className="note">{sevs.filter((v) => v !== 2).map((v) => `SEV-${v} ${hours(s.medianTtr[v].hours)} (n=${s.medianTtr[v].n})`).join(' · ')}{sevs.some((v) => s.medianTtr[v].n > 0 && s.medianTtr[v].n < 3) ? ' · n<3 is too few to compare' : ''}</div></div>
        <div className="kpi"><div className="label">Resolved within SLA</div><div className="value">{s.slaMet.met} of {s.slaMet.of}</div><div className="note">SLA: {sevs.map((v) => `SEV-${v} ${hours(SLA_HOURS[v])}`).join(' · ')}</div></div>
        <div className="kpi"><div className="label">Post-incident reviews complete</div><div className="value">{s.pirComplete.complete} of {s.pirComplete.of}</div><div className="note">{overdue} overdue · {plural(s.repeats, 'repeat')} of an earlier root cause</div></div>
      </div>
      <Tabs label="Incident views" panelId="inc-panel" value={tab} onChange={setTab} tabs={[{ id: 'open', label: 'Open', count: open.length }, { id: 'resolved', label: 'Resolved' }, { id: 'all', label: 'All' }]} />
      <div id="inc-panel" role="tabpanel" aria-labelledby={`inc-panel-${tab}`}>
        {rows.length === 0 ? <div className="empty">No incidents here.</div> : (
          <div className="table-wrap">
            <table className="stack-sm">
              <thead><tr><th>Incident</th><th>Severity</th><th>Status</th><th>Detected</th><th className="num">Time to resolve</th><th>Root cause</th><th>Review</th></tr></thead>
              <tbody>
                {rows.map((i) => {
                  const e = ctx.incidentEval[i.id];
                  return (
                    <tr key={i.id}>
                      <td data-label="Incident"><a className="rowbtn" href={`#/incidents/${i.id}`}>{i.title}</a><div className="sub"><span className="mono">{i.id}</span> · {AREA_INFO[i.area].label} · {i.accountsAffected} accounts</div>{e.repeatOf.length > 0 && <div style={{ marginTop: 4 }}><Chip tone="cau">Repeat of {e.repeatOf.join(', ')}</Chip></div>}</td>
                      <td data-label="Severity"><SevChip s={i.severity} /></td>
                      <td data-label="Status"><StatusChip s={i.status} /></td>
                      <td data-label="Detected" className="sub" style={{ whiteSpace: 'nowrap' }}>{dateTime(i.detectedAt)}</td>
                      <td data-label="Time to resolve" className="num">{e.ttrHours !== null ? hours(e.ttrHours) : <span className="muted">{hours(e.ageHours)} open</span>}<div><Chip tone={SLA_TONE[e.slaState][0]}>{SLA_TONE[e.slaState][1]}</Chip></div></td>
                      <td data-label="Root cause">{i.rootCause ? ROOT_CAUSE_LABEL[i.rootCause] : <span className="muted">Not yet known</span>}{i.rootCauseNote && <div className="sub clip">{i.rootCauseNote}</div>}</td>
                      <td data-label="Review">{i.status !== 'resolved' && i.severity <= 3 ? <span className="muted">Due after resolve</span> : <Chip tone={PIR_TONE[e.pirState][0]}>{PIR_TONE[e.pirState][1]}</Chip>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="tfoot"><span>{rows.length} of {all.length} incidents</span><span>{all.reduce((n, i) => n + i.accountsAffected, 0).toLocaleString('en-US')} account-impacts across {all.length} incidents</span></div>
      </div>
      <DeclareDrawer ctx={ctx} open={declaring} onClose={() => setDeclaring(false)} />
    </>
  );
}

function timeline(inc: Incident): { at: string; text: string }[] {
  const ev = [{ at: inc.detectedAt, text: `Declared SEV-${inc.severity}; ${inc.commander} is commander.` }, ...inc.updates];
  if (inc.mitigatedAt && !inc.updates.some((u) => u.at === inc.mitigatedAt)) ev.push({ at: inc.mitigatedAt, text: 'Mitigated; customer impact stopped.' });
  if (inc.resolvedAt && !inc.updates.some((u) => u.at === inc.resolvedAt)) ev.push({ at: inc.resolvedAt, text: 'Resolved; root cause recorded.' });
  return ev.sort((a, b) => b.at.localeCompare(a.at));
}

type Mode = 'update' | 'severity' | 'mitigate' | 'resolve' | null;

function IncidentDetail({ ctx, inc }: { ctx: Ctx; inc: Incident }) {
  const e = ctx.incidentEval[inc.id];
  const [mode, setMode] = useState<Mode>(null);
  const launch = inc.linkedLaunchId ? ctx.state.launches.find((l) => l.id === inc.linkedLaunchId) : null;
  return (
    <>
      <PageHead crumb={<><a href="#/">Launch Control</a> / <a href="#/incidents">Incidents</a> / <span className="mono">{inc.id}</span></>} title={inc.title}
        actions={inc.status !== 'resolved' ? <>
          <button type="button" className="btn" onClick={() => setMode('update')}>Post update</button>
          <button type="button" className="btn" onClick={() => setMode('severity')}>Change severity</button>
          {inc.status === 'investigating' && <button type="button" className="btn" onClick={() => setMode('mitigate')}>Mark mitigated</button>}
          <button type="button" className="btn primary" onClick={() => setMode('resolve')}>Resolve</button>
        </> : undefined} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <SevChip s={inc.severity} /><StatusChip s={inc.status} /><Chip tone={SLA_TONE[e.slaState][0]}>{SLA_TONE[e.slaState][1]}</Chip>
        {e.repeatOf.length > 0 && <Chip tone="cau">Repeat of {e.repeatOf.join(', ')}</Chip>}
      </div>
      <div className="grid2" style={{ marginBottom: 26 }}>
        <dl className="kv">
          <dt>Customer impact</dt><dd>{inc.customerImpact}</dd>
          <dt>Area and commander</dt><dd>{AREA_INFO[inc.area].label} · {inc.commander}</dd>
          <dt>Accounts affected</dt><dd>{inc.accountsAffected.toLocaleString('en-US')}</dd>
          <dt>Detected</dt><dd>{dateTime(inc.detectedAt)}</dd>
          <dt>Time to mitigate</dt><dd>{hours(e.ttmHours)}</dd>
          <dt>Time to resolve</dt><dd>{e.ttrHours !== null ? `${hours(e.ttrHours)} against a ${hours(e.slaHours)} SLA` : `Open ${hours(e.ageHours)} of a ${hours(e.slaHours)} SLA`}</dd>
          <dt>Root cause</dt><dd>{inc.rootCause ? <><strong style={{ fontWeight: 500 }}>{ROOT_CAUSE_LABEL[inc.rootCause]}.</strong> {inc.rootCauseNote}</> : <span className="muted">Not yet known. Resolving requires a root-cause category and note.</span>}</dd>
          <dt>Customer voice</dt><dd>{inc.linkedThemeId ? <a href="#/voice">{THEME_BY_ID.get(inc.linkedThemeId)!.title}</a> : '—'}</dd>
          <dt>Launch</dt><dd>{launch ? <><a href={`#/launches/${launch.id}`}>{launch.name}</a> <span className="sub">{ctx.launchEval[launch.id].verdict === 'no_go' ? 'blocked by this incident' : ''}</span></> : '—'}</dd>
        </dl>
        <div>
          <h3>Timeline</h3>
          <ol className="timeline">{timeline(inc).map((u, i) => <li key={i}><div className="sub">{dateTime(u.at)}</div>{u.text}</li>)}</ol>
        </div>
      </div>
      {inc.status === 'resolved' && <PirSection ctx={ctx} inc={inc} />}
      <ActionDrawer ctx={ctx} inc={inc} mode={mode} onClose={() => setMode(null)} />
    </>
  );
}

function PirSection({ ctx, inc }: { ctx: Ctx; inc: Incident }) {
  const e = ctx.incidentEval[inc.id];
  const p = inc.pir;
  const [summary, setSummary] = useState(p?.summary ?? '');
  const [whys, setWhys] = useState<string[]>(() => Array.from({ length: 5 }, (_, i) => p?.whys[i] ?? ''));
  const [actions, setActions] = useState(() => Array.from({ length: 3 }, (_, i) => ({ text: p?.actionItems[i]?.text ?? '', owner: p?.actionItems[i]?.owner ?? '', due: p?.actionItems[i]?.due ?? '' })));
  const [busy, setBusy] = useState(false);
  const draft = { summary, whys: whys.filter((w) => w.trim()), actionItems: actions.filter((a) => a.text.trim() || a.owner.trim() || a.due.trim()) };
  const problems = pirProblems({ ...draft, actionItems: draft.actionItems.map((a, i) => ({ ...a, id: String(i), done: false })) });
  const save = async () => { setBusy(true); await ctx.act({ type: 'save_pir', incidentId: inc.id, ...draft }); setBusy(false); };
  const complete = async () => { setBusy(true); const r = await ctx.act({ type: 'save_pir', incidentId: inc.id, ...draft }); if (r.ok) await ctx.act({ type: 'complete_pir', incidentId: inc.id }); setBusy(false); };
  const toggle = async (actionId: string, done: boolean) => { setBusy(true); await ctx.act({ type: 'toggle_action', incidentId: inc.id, actionId, done }); setBusy(false); };

  return (
    <section aria-labelledby="pir-h">
      <h2 id="pir-h">Post-incident review <Chip tone={PIR_TONE[e.pirState][0]}>{PIR_TONE[e.pirState][1]}</Chip></h2>
      {e.pirDue && e.pirState !== 'complete' && <p className="note-line">Due {dateTime(e.pirDue)}. Completing it needs a summary, at least three answered whys and one action item with an owner and due date.</p>}
      {p?.status === 'complete' ? (
        <div className="grid2">
          <div className="stack">
            <p style={{ margin: 0 }}>{p.summary}</p>
            <div><h3>Why it happened</h3><ol className="whys">{p.whys.map((w, i) => <li key={i}>{w}</li>)}</ol></div>
            <p className="sub" style={{ margin: 0 }}>Completed {p.completedAt ? dateTime(p.completedAt) : ''}</p>
          </div>
          <div>
            <h3>Action items</h3>
            <ul className="feed">
              {p.actionItems.map((a) => (
                <li key={a.id} style={{ gridTemplateColumns: '28px 1fr' }}>
                  <input type="checkbox" checked={a.done} disabled={busy} onChange={(ev) => toggle(a.id, ev.target.checked)} aria-label={`Mark "${a.text}" ${a.done ? 'open' : 'done'}`} />
                  <span>{a.text}<div className="sub">{a.owner} · due {a.due}{a.done ? ' · done' : ''}</div></span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="stack" style={{ maxWidth: 820 }}>
          <label className="field">Summary<textarea value={summary} onChange={(ev) => setSummary(ev.target.value)} maxLength={600} /></label>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 8 }}>
            <legend className="sub" style={{ marginBottom: 6 }}>Five Whys</legend>
            {whys.map((w, i) => <label key={i} className="field">Why {i + 1}<input value={w} onChange={(ev) => setWhys(whys.map((x, j) => (j === i ? ev.target.value : x)))} maxLength={400} /></label>)}
          </fieldset>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 8 }}>
            <legend className="sub" style={{ marginBottom: 6 }}>Action items</legend>
            {actions.map((a, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
                <label className="field">Action {i + 1}<input value={a.text} onChange={(ev) => setActions(actions.map((x, j) => (j === i ? { ...x, text: ev.target.value } : x)))} /></label>
                <label className="field">Owner<input value={a.owner} onChange={(ev) => setActions(actions.map((x, j) => (j === i ? { ...x, owner: ev.target.value } : x)))} /></label>
                <label className="field">Due<input type="date" value={a.due} onChange={(ev) => setActions(actions.map((x, j) => (j === i ? { ...x, due: ev.target.value } : x)))} /></label>
              </div>
            ))}
          </fieldset>
          {problems.length > 0 && <div className="err" role="status"><strong>Not ready to complete:</strong><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{problems.map((x) => <li key={x}>{x}</li>)}</ul></div>}
          <div className="actions">
            <button type="button" className="btn" disabled={busy || !summary.trim()} onClick={save}>Save draft</button>
            <button type="button" className="btn primary" disabled={busy || problems.length > 0} onClick={complete}>Complete review</button>
          </div>
        </div>
      )}
    </section>
  );
}

function ActionDrawer({ ctx, inc, mode, onClose }: { ctx: Ctx; inc: Incident; mode: Mode; onClose: () => void }) {
  const [text, setText] = useState('');
  const [sev, setSev] = useState<Severity>(inc.severity);
  const [cause, setCause] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const close = () => { setText(''); setCause(''); setError(null); setSev(inc.severity); onClose(); };
  const titles: Record<string, string> = { update: 'Post update', severity: 'Change severity', mitigate: 'Mark mitigated', resolve: 'Resolve incident' };
  const submit = async () => {
    setBusy(true);
    const cmd = mode === 'update' ? { type: 'post_update', incidentId: inc.id, text }
      : mode === 'severity' ? { type: 'set_severity', incidentId: inc.id, severity: sev, reason: text }
      : mode === 'mitigate' ? { type: 'mitigate', incidentId: inc.id, note: text }
      : { type: 'resolve', incidentId: inc.id, rootCause: cause, rootCauseNote: text };
    const r = await ctx.act(cmd);
    setBusy(false);
    if (r.ok) close(); else setError(r.message);
  };
  return (
    <Drawer open={!!mode} onClose={close} title={mode ? titles[mode] : ''} sub={`${inc.id} · ${inc.title}`}
      footer={<button type="button" className="btn primary" disabled={busy} onClick={submit}>{mode ? titles[mode] : ''}</button>}>
      {mode === 'severity' && (
        <label className="field">Severity
          <select value={sev} onChange={(e) => setSev(Number(e.target.value) as Severity)}>{[1, 2, 3, 4].map((v) => <option key={v} value={v}>SEV-{v} (SLA {hours(SLA_HOURS[v as Severity])})</option>)}</select>
        </label>
      )}
      {mode === 'resolve' && (
        <label className="field">Root-cause category (required)
          <select value={cause} onChange={(e) => setCause(e.target.value)}>
            <option value="">Choose…</option>
            {ROOT_CAUSES.map((c) => <option key={c} value={c}>{ROOT_CAUSE_LABEL[c]}</option>)}
          </select>
        </label>
      )}
      <label className="field">{mode === 'resolve' ? 'Root-cause note, at least 20 characters (required)' : mode === 'severity' ? 'Reason (required)' : mode === 'mitigate' ? 'What was done (required)' : 'Update'}
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={400} />
      </label>
      {mode === 'resolve' && inc.severity <= 3 && <p className="sub" style={{ margin: 0 }}>Resolving starts the post-incident review clock.</p>}
      {error && <div className="err" role="alert">{error}</div>}
    </Drawer>
  );
}

function DeclareDrawer({ ctx, open, onClose }: { ctx: Ctx; open: boolean; onClose: () => void }) {
  const blank = { title: '', area: 'cards', severity: 3, commander: '', accountsAffected: '0', customerImpact: '', linkedThemeId: '' };
  const [f, setF] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const close = () => { setF(blank); setError(null); onClose(); };
  const n = Number(f.accountsAffected);
  const submit = async () => {
    setBusy(true);
    const r = await ctx.act({ type: 'declare_incident', title: f.title, area: f.area, severity: f.severity, commander: f.commander, accountsAffected: Number.isInteger(n) ? n : -1, customerImpact: f.customerImpact, ...(f.linkedThemeId ? { linkedThemeId: f.linkedThemeId } : {}) });
    setBusy(false);
    if (r.ok) { close(); const id = r.extra.incidentId; if (typeof id === 'string') location.hash = `#/incidents/${id}`; } else setError(r.message);
  };
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF({ ...f, [k]: k === 'severity' ? Number(e.target.value) : e.target.value });
  return (
    <Drawer open={open} onClose={close} title="Declare incident" sub="Starts the SLA clock now."
      footer={<button type="button" className="btn primary" disabled={busy} onClick={submit}>Declare incident</button>}>
      <label className="field">Title<input value={f.title} onChange={set('title')} maxLength={120} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label className="field">Product area<select value={f.area} onChange={set('area')}>{PRODUCT_AREAS.map((a) => <option key={a} value={a}>{AREA_INFO[a].label}</option>)}</select></label>
        <label className="field">Severity<select value={f.severity} onChange={set('severity')}>{[1, 2, 3, 4].map((v) => <option key={v} value={v}>SEV-{v}</option>)}</select></label>
        <label className="field">Commander<input value={f.commander} onChange={set('commander')} maxLength={60} /></label>
        <label className="field">Accounts affected<input inputMode="numeric" value={f.accountsAffected} onChange={set('accountsAffected')} /></label>
      </div>
      <label className="field">Customer impact<textarea value={f.customerImpact} onChange={set('customerImpact')} maxLength={400} /></label>
      <label className="field">Linked customer-voice theme (optional)<select value={f.linkedThemeId} onChange={set('linkedThemeId')}><option value="">None</option>{THEMES.map((t) => <option key={t.id} value={t.id}>{AREA_INFO[t.area].label} · {t.title}</option>)}</select></label>
      {error && <div className="err" role="alert">{error}</div>}
    </Drawer>
  );
}
