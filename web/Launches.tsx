import { useState } from 'react';
import { AREA_INFO, ITEM_CATEGORIES, ITEM_STATUSES, type ChecklistItem, type ItemStatus, type Launch } from '../src/engine/types.ts';
import { THEME_BY_ID } from '../src/engine/themes.ts';
import { ENABLEMENT_LEAD_DAYS, roleLabel } from '../src/engine/launch.ts';
import { Chip, Drawer, Meter, PageHead, VerdictChip, VERDICT_LABEL, type Ctx, type Tone } from './ui.tsx';
import { dateOnly, dateTime } from './format.ts';

const STAGE: Record<Launch['stage'], string> = { alpha: 'Alpha', beta: 'Beta', ga: 'General availability' };
const CAT: Record<string, string> = { enablement: 'Enablement docs', support: 'Support readiness', quality: 'Quality', comms: 'Customer comms', measurement: 'Measurement' };
const ITEM_TONE: Record<ItemStatus, [Tone, string]> = { not_started: ['neu', 'Not started'], in_progress: ['cau', 'In progress'], done: ['pos', 'Done'], blocked: ['neg', 'Blocked'] };
const PHASE: Record<string, string> = { ready: 'Ready', mid_flight: 'Mid-flight', blocked: 'Blocked', early: 'Early' };
const days = (n: number) => (n === 0 ? 'today' : n > 0 ? `in ${n} day${n === 1 ? '' : 's'}` : `${-n} day${n === -1 ? '' : 's'} late`);

export function LaunchesPage({ ctx, id }: { ctx: Ctx; id?: string }) {
  const launch = id ? ctx.state.launches.find((l) => l.id === id) : undefined;
  if (id && !launch) return <><h1>Launch not found</h1><p><a href="#/launches">Back to launches</a></p></>;
  if (launch) return <LaunchDetail ctx={ctx} l={launch} />;
  const list = [...ctx.state.launches].sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  return (
    <>
      <PageHead crumb={<><a href="#/">Launch Control</a> / Launches</>} title="Launch readiness" count={`${list.length} upcoming`} />
      <p className="note-line">A launch is GO only when every critical item is done with evidence, no SEV-1 or SEV-2 incident is open in its product area, enablement is done {ENABLEMENT_LEAD_DAYS} days before target, and all four sign-offs match the current checklist. Any change to the checklist makes earlier sign-offs stale.</p>
      <div className="launch-cards">
        {list.map((l) => {
          const e = ctx.launchEval[l.id];
          const signed = e.signoffs.filter((s) => s.state === 'current').length;
          return (
            <a key={l.id} className="lcard" href={`#/launches/${l.id}`} style={{ textDecoration: 'none' }} data-testid={`launch-${l.id}`}>
              <div>
                <div style={{ fontSize: 15, color: 'var(--text-strong)', fontWeight: 500 }}>{l.name}</div>
                <div className="sub"><span className="mono">{l.id}</span> · {AREA_INFO[l.area].label} · {STAGE[l.stage]} · target {dateOnly(l.targetDate)} ({days(e.daysToTarget)})</div>
                {e.verdict === 'no_go' && <div className="reason">{e.blockers[0]}</div>}
                {e.verdict === 'hold' && <div className="sub" style={{ marginTop: 4 }}>{e.holds[0]}</div>}
              </div>
              <Meter label="Enablement docs" done={e.enablement.done} total={e.enablement.total} />
              <Meter label="Support readiness" done={e.support.done} total={e.support.total} />
              <div className="hide-md"><Meter label="Critical items" done={e.critical.done} total={e.critical.total} /></div>
              <div className="hide-md"><div className="sub">Sign-offs</div><div>{signed} of 4</div></div>
              <div style={{ display: 'grid', gap: 4, justifyItems: 'start' }}><VerdictChip v={e.verdict} /><span className="sub">{PHASE[e.phase]}</span></div>
            </a>
          );
        })}
      </div>
      <div className="tfoot"><span>{list.length} launches</span><span>{Object.values(ctx.launchEval).filter((e) => e.verdict === 'go').length} GO · {Object.values(ctx.launchEval).filter((e) => e.verdict === 'hold').length} HOLD · {Object.values(ctx.launchEval).filter((e) => e.verdict === 'no_go').length} NO-GO</span></div>
    </>
  );
}

function LaunchDetail({ ctx, l }: { ctx: Ctx; l: Launch }) {
  const e = ctx.launchEval[l.id];
  const [editing, setEditing] = useState<ChecklistItem | null>(null);
  const [deciding, setDeciding] = useState<'go' | 'no_go' | null>(null);
  const [busy, setBusy] = useState(false);
  const related = ctx.state.incidents.filter((i) => i.linkedLaunchId === l.id || (i.area === l.area && i.status !== 'resolved'));
  const sign = async (role: string) => { setBusy(true); await ctx.act({ type: 'sign_off', launchId: l.id, role }); setBusy(false); };
  return (
    <>
      <PageHead crumb={<><a href="#/">Launch Control</a> / <a href="#/launches">Launches</a> / <span className="mono">{l.id}</span></>} title={l.name}
        actions={<>
          <button type="button" className="btn" onClick={() => setDeciding('no_go')}>Record NO-GO</button>
          <button type="button" className="btn primary" disabled={e.verdict !== 'go'} aria-describedby="go-hint" onClick={() => setDeciding('go')}>Record GO</button>
        </>} />
      <div className={`verdict ${e.verdict}`} data-testid="verdict">
        <div className="word">{VERDICT_LABEL[e.verdict]}</div>
        <div>
          {e.blockers.length > 0 && <><p className="why-label">Blocked because</p><ul>{e.blockers.map((b) => <li key={b}>{b}</li>)}</ul></>}
          {e.holds.length > 0 && <><p className="why-label" style={{ marginTop: e.blockers.length ? 10 : 0 }}>Still open</p><ul>{e.holds.map((b) => <li key={b}>{b}</li>)}</ul></>}
          {e.verdict === 'go' && <p style={{ margin: 0 }}>Every critical item has evidence, enablement landed on time, no SEV-1/2 is open in {AREA_INFO[l.area].label}, and all four sign-offs match checklist <span className="mono">{e.fingerprint.slice(0, 8)}</span>.</p>}
          <p id="go-hint" className="sub" style={{ margin: '8px 0 0' }}>
            {l.decision ? `Decision on record: ${l.decision.verdict === 'go' ? 'GO' : 'NO-GO'} · ${dateTime(l.decision.at)} · ${e.decisionState === 'current' ? 'matches the current checklist' : 'stale: checklist changed since'} · “${l.decision.note}”` : e.verdict === 'go' ? 'Ready for a GO decision.' : 'GO can only be recorded once the gate shows GO.'}
          </p>
        </div>
      </div>
      <div className="grid2" style={{ marginBottom: 26 }}>
        <dl className="kv">
          <dt>What ships</dt><dd>{l.summary}</dd>
          <dt>Area and stage</dt><dd>{AREA_INFO[l.area].label} · {STAGE[l.stage]}</dd>
          <dt>Target</dt><dd>{dateOnly(l.targetDate)} ({days(e.daysToTarget)})</dd>
          <dt>Customer voice</dt><dd>{l.linkedThemeIds.map((t) => { const v = ctx.voice.themes.find((x) => x.themeId === t)!; return <div key={t}><a href="#/voice">{THEME_BY_ID.get(t)!.title}</a> <span className="sub">{v.rank ? `#${v.rank}` : 'watch'} · {v.accounts} accounts</span></div>; })}</dd>
          <dt>Incidents</dt><dd>{related.length === 0 ? <span className="muted">None open in this area</span> : related.map((i) => <div key={i.id}><a className="mono" href={`#/incidents/${i.id}`}>{i.id}</a> SEV-{i.severity} · {i.status}</div>)}</dd>
        </dl>
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <Meter label="Enablement docs" done={e.enablement.done} total={e.enablement.total} />
          <Meter label="Support readiness" done={e.support.done} total={e.support.total} />
          <Meter label="All checklist items" done={e.overall.done} total={e.overall.total} />
        </div>
      </div>
      <h2>Sign-offs</h2>
      <div className="signoffs" style={{ marginBottom: 26 }}>
        {e.signoffs.map((s) => (
          <div key={s.role}>
            <span className="sub">{roleLabel(s.role)}</span>
            <span>{s.name}</span>
            <span>{s.state === 'current' ? <Chip tone="pos">Signed</Chip> : s.state === 'stale' ? <Chip tone="cau">Stale</Chip> : <Chip tone="neu">Not signed</Chip>}</span>
            {s.at && <span className="sub">{dateTime(s.at)}</span>}
            {s.state !== 'current' && <button type="button" className="btn sm" disabled={busy} onClick={() => sign(s.role)} style={{ justifySelf: 'start' }}>Sign off as {roleLabel(s.role)}</button>}
          </div>
        ))}
      </div>
      <h2>Checklist</h2>
      {ITEM_CATEGORIES.map((c) => {
        const rows = l.items.filter((i) => i.category === c);
        if (rows.length === 0) return null;
        return (
          <section key={c} style={{ marginBottom: 18 }} aria-label={CAT[c]}>
            <h3>{CAT[c]} <span className="sub">{rows.filter((r) => r.status === 'done').length} of {rows.length} done</span></h3>
            <div className="table-wrap">
              <table className="stack-sm">
                <thead><tr><th>Item</th><th>Owner</th><th>Due</th><th>Status</th><th>Evidence or reason</th><th><span className="sr-only">Action</span></th></tr></thead>
                <tbody>
                  {rows.map((i) => (
                    <tr key={i.id}>
                      <td data-label="Item">{i.label} {i.critical && <span className="sub">· critical</span>}</td>
                      <td data-label="Owner">{i.owner}</td>
                      <td data-label="Due" className="sub">{dateOnly(i.due)}</td>
                      <td data-label="Status"><Chip tone={ITEM_TONE[i.status][0]}>{ITEM_TONE[i.status][1]}</Chip></td>
                      <td data-label="Evidence" className={i.status === 'blocked' ? 'reason' : 'sub'}>{i.evidence ?? i.blockedReason ?? '—'}</td>
                      <td><button type="button" className="btn sm" onClick={() => setEditing(i)} aria-label={`Update ${i.label}`}>Update</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      <ItemDrawer ctx={ctx} l={l} item={editing} onClose={() => setEditing(null)} />
      <DecisionDrawer ctx={ctx} l={l} verdict={deciding} onClose={() => setDeciding(null)} />
    </>
  );
}

function ItemDrawer({ ctx, l, item, onClose }: { ctx: Ctx; l: Launch; item: ChecklistItem | null; onClose: () => void }) {
  const [status, setStatus] = useState<ItemStatus | ''>('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cur = status || item?.status || 'not_started';
  const close = () => { setStatus(''); setText(''); setError(null); onClose(); };
  const save = async () => {
    setBusy(true);
    const cmd: Record<string, unknown> = { type: 'set_item', launchId: l.id, itemId: item!.id, status: cur };
    if (cur === 'done') cmd.evidence = text || item!.evidence || '';
    if (cur === 'blocked') cmd.blockedReason = text || item!.blockedReason || '';
    const r = await ctx.act(cmd);
    setBusy(false);
    if (r.ok) close(); else setError(r.message);
  };
  return (
    <Drawer open={!!item} onClose={close} title={item?.label ?? ''} sub={item ? `${l.id} · ${CAT[item.category]} · owner ${item.owner}` : ''}
      footer={<button type="button" className="btn primary" disabled={busy} onClick={save}>Save</button>}>
      {item && (
        <>
          <label className="field">Status
            <select value={cur} onChange={(e) => { setStatus(e.target.value as ItemStatus); setText(''); setError(null); }}>
              {ITEM_STATUSES.map((s) => <option key={s} value={s}>{ITEM_TONE[s][1]}</option>)}
            </select>
          </label>
          {cur === 'done' && <label className="field">Evidence: a link, doc name or run ID (required)<input value={text} placeholder={item.evidence ?? 'e.g. help/bill-pay/approval-delegates'} onChange={(e) => setText(e.target.value)} maxLength={160} /></label>}
          {cur === 'blocked' && <label className="field">What is blocking it (required)<textarea value={text} placeholder={item.blockedReason ?? ''} onChange={(e) => setText(e.target.value)} maxLength={200} /></label>}
          <p className="sub" style={{ margin: 0 }}>Saving changes the checklist fingerprint, so any sign-off given before this change becomes stale.</p>
          {error && <div className="err" role="alert">{error}</div>}
        </>
      )}
    </Drawer>
  );
}

function DecisionDrawer({ ctx, l, verdict, onClose }: { ctx: Ctx; l: Launch; verdict: 'go' | 'no_go' | null; onClose: () => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const close = () => { setNote(''); setError(null); onClose(); };
  const save = async () => {
    setBusy(true);
    const r = await ctx.act({ type: 'record_decision', launchId: l.id, verdict, note });
    setBusy(false);
    if (r.ok) close(); else setError(r.message);
  };
  return (
    <Drawer open={!!verdict} onClose={close} title={verdict === 'go' ? 'Record GO' : 'Record NO-GO'} sub={l.name}
      footer={<button type="button" className="btn primary" disabled={busy} onClick={save}>Record {verdict === 'go' ? 'GO' : 'NO-GO'}</button>}>
      <label className="field">Decision note (required)<textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} placeholder={verdict === 'go' ? 'e.g. Ship Tuesday 10:00 ET, support rota confirmed' : 'e.g. Hold until INC-2214 is resolved and macros are final'} /></label>
      {error && <div className="err" role="alert">{error}</div>}
    </Drawer>
  );
}
