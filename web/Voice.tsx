import { useMemo, useState } from 'react';
import { THEMES, THEME_BY_ID, ROUTE_THRESHOLD, AMBIGUITY_MARGIN, MIN_ACCOUNTS_TO_RANK } from '../src/engine/themes.ts';
import { triage } from '../src/engine/triage.ts';
import { validateImport, CSV_HEADER } from '../src/engine/csv.ts';
import { AREA_INFO, PRODUCT_AREAS, type FeedbackItem, type ProductArea, type Triage } from '../src/engine/types.ts';
import type { ThemeView } from '../src/engine/voice.ts';
import { Chip, Drawer, PageHead, Tabs, type Ctx } from './ui.tsx';
import { CHANNEL_LABEL, SEGMENT_LABEL, ago, dateTime, money, plural } from './format.ts';

type Tab = 'themes' | 'inbox' | 'review' | 'rules';

function RouteChip({ t }: { t: Triage }) {
  if (t.status === 'rejected') return <Chip tone="neg">Rejected</Chip>;
  if (t.status === 'needs_human') return <Chip tone="cau">Needs a person</Chip>;
  return <Chip tone="pos">{AREA_INFO[t.area!].label}</Chip>;
}

export function VoicePage({ ctx }: { ctx: Ctx }) {
  const { voice, state } = ctx;
  const [tab, setTab] = useState<Tab>('themes');
  const [area, setArea] = useState<ProductArea | 'all'>('all');
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [openTheme, setOpenTheme] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const tri = useMemo(() => new Map(voice.triage.map((t) => [t.feedbackId, t])), [voice]);
  const items = [...state.feedback].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const review = items.filter((f) => tri.get(f.id)!.status !== 'routed');
  const shown = (tab === 'review' ? review : items).filter((f) => area === 'all' || tri.get(f.id)!.area === area || (tab === 'review'));
  const themes = voice.themes.filter((t) => area === 'all' || t.area === area);
  const ranked = voice.themes.filter((t) => t.rank !== null).length;

  return (
    <>
      <PageHead crumb={<><a href="#/">Launch Control</a> / Customer voice</>} title="Customer voice" count={plural(voice.totals.items, 'item')}
        actions={<button type="button" className="btn primary" onClick={() => setImporting(true)}>Import feedback</button>} />
      <Tabs label="Customer voice views" panelId="voice-panel" value={tab} onChange={setTab} tabs={[
        { id: 'themes', label: 'Themes' }, { id: 'inbox', label: 'Inbox' }, { id: 'review', label: 'Not routed', count: review.length }, { id: 'rules', label: 'Routing rules' },
      ]} />
      <div id="voice-panel" role="tabpanel" aria-labelledby={`voice-panel-${tab}`}>
        {tab !== 'rules' && tab !== 'review' && (
          <div className="filters" role="group" aria-label="Filter by product area">
            {(['all', ...PRODUCT_AREAS] as const).map((a) => (
              <button key={a} type="button" className="fchip" aria-pressed={area === a} onClick={() => setArea(a)}>{a === 'all' ? 'All areas' : AREA_INFO[a].label}</button>
            ))}
          </div>
        )}
        {tab === 'themes' && (
          <>
            <p className="note-line">Score = distinct accounts × their ARR in $M (frequency × revenue impact). Themes under {MIN_ACCOUNTS_TO_RANK} accounts stay on watch however many mentions they get, so one loud account cannot outrank a pattern.</p>
            <div className="table-wrap">
              <table className="stack-sm">
                <thead><tr><th>Rank</th><th>Theme</th><th className="num">Mentions</th><th className="num">Accounts</th><th className="num">ARR</th><th className="num">Score</th><th>Linked</th><th>Hand-off</th></tr></thead>
                <tbody>
                  {themes.map((t) => (
                    <tr key={t.themeId}>
                      <td data-label="Rank" className="mono">{t.rank ? `#${t.rank}` : <Chip tone="neu" dot={false}>Watch</Chip>}</td>
                      <td data-label="Theme">
                        <button type="button" className="rowbtn" onClick={() => setOpenTheme(t.themeId)}>{t.title}</button>
                        <div className="sub">{AREA_INFO[t.area].label} · {AREA_INFO[t.area].owner}</div>
                        {t.watchReason && <div className="sub">{t.watchReason}</div>}
                      </td>
                      <td data-label="Mentions" className="num">{t.mentions}</td>
                      <td data-label="Accounts" className="num">{t.accounts}</td>
                      <td data-label="ARR" className="num">{money(t.arrUsd)}</td>
                      <td data-label="Score" className="num mono">{t.watchReason ? '—' : t.score.toFixed(1)}</td>
                      <td data-label="Linked" className="sub">
                        {t.incidentIds.length + t.launchIds.length === 0 ? '—' : (
                          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {t.launchIds.map((id) => <a key={id} className="mono" href={`#/launches/${id}`}>{id}</a>)}
                            {t.incidentIds.slice(-2).map((id) => <a key={id} className="mono" href={`#/incidents/${id}`}>{id}</a>)}
                          </span>
                        )}
                      </td>
                      <td data-label="Hand-off"><HandoffCell t={t} ctx={ctx} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="tfoot"><span>{ranked} ranked · {voice.themes.length - ranked} on watch</span><span>{voice.totals.routed} of {voice.totals.items} items routed · {voice.totals.accounts} accounts · {money(voice.totals.arrUsd)} ARR</span></div>
          </>
        )}
        {(tab === 'inbox' || tab === 'review') && (
          <>
            {tab === 'review' && <p className="note-line">The agent does not guess. These items scored under the routing threshold, were ambiguous between product areas, or were too short to triage. Open one to route it with a note.</p>}
            {shown.length === 0 ? <div className="empty">Nothing here.</div> : (
              <div className="table-wrap">
                <table className="stack-sm">
                  <thead><tr><th>ID</th><th>Received</th><th>Account</th><th>Feedback</th><th>Routed to</th><th>By</th></tr></thead>
                  <tbody>
                    {shown.map((f) => {
                      const t = tri.get(f.id)!;
                      return (
                        <tr key={f.id}>
                          <td data-label="ID"><button type="button" className="rowbtn mono" onClick={() => setOpenItem(f.id)} aria-label={`Open ${f.id}`}>{f.id}</button></td>
                          <td data-label="Received" className="sub" style={{ whiteSpace: 'nowrap' }}>{ago(f.receivedAt, ctx.now)}<div>{CHANNEL_LABEL[f.channel]}</div></td>
                          <td data-label="Account">{f.accountName}<div className="sub"><span className="mono">{f.accountId}</span> · {SEGMENT_LABEL[f.segment]} · {money(f.arrUsd)}</div></td>
                          <td data-label="Feedback"><span className="clip">{f.text}</span></td>
                          <td data-label="Routed to"><RouteChip t={t} />{t.themeId && <div className="sub" style={{ marginTop: 4 }}>{THEME_BY_ID.get(t.themeId)!.title}</div>}</td>
                          <td data-label="By" className="sub">{t.by === 'human' ? 'Person' : 'Agent'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="tfoot"><span>{shown.length} of {voice.totals.items} items</span><span>{voice.totals.routed} routed · {voice.totals.needsHuman} need a person · {voice.totals.rejected} rejected · {voice.totals.byHuman} routed by a person</span></div>
          </>
        )}
        {tab === 'rules' && <Rules />}
      </div>
      <ItemDrawer ctx={ctx} item={state.feedback.find((f) => f.id === openItem) ?? null} t={openItem ? tri.get(openItem) ?? null : null} onClose={() => setOpenItem(null)} />
      <ThemeDrawer ctx={ctx} t={voice.themes.find((x) => x.themeId === openTheme) ?? null} onClose={() => setOpenTheme(null)} onItem={(id) => { setOpenTheme(null); setOpenItem(id); }} />
      <ImportDrawer ctx={ctx} open={importing} onClose={() => setImporting(false)} />
    </>
  );
}

function HandoffCell({ t, ctx }: { t: ThemeView; ctx: Ctx }) {
  const [busy, setBusy] = useState(false);
  const h = ctx.state.handoffs[t.themeId];
  if (t.watchReason) return <span className="sub">Below bar</span>;
  if (t.handoff === 'current') return <span><Chip tone="pos">Brief {h.receiptId}</Chip><div className="sub" style={{ marginTop: 4 }}>{ago(h.at, ctx.now)}</div></span>;
  const go = async () => { setBusy(true); await ctx.act({ type: 'handoff_theme', themeId: t.themeId }); setBusy(false); };
  return (
    <span>
      <button type="button" className="btn sm" disabled={busy} onClick={go}>{t.handoff === 'stale' ? 'Re-send' : 'Route'} to {AREA_INFO[t.area].label}</button>
      {t.handoff === 'stale' && <div className="sub" style={{ marginTop: 4 }}>{h.receiptId} is stale: {plural(t.newSinceHandoff, 'new item')}</div>}
    </span>
  );
}

function ItemDrawer({ ctx, item, t, onClose }: { ctx: Ctx; item: FeedbackItem | null; t: Triage | null; onClose: () => void }) {
  const [themeId, setThemeId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const override = item ? ctx.state.overrides[item.id] : undefined;
  const close = () => { setThemeId(''); setNote(''); setError(null); onClose(); };
  const submit = async () => {
    setBusy(true);
    const r = await ctx.act({ type: 'override_route', feedbackId: item!.id, themeId, note });
    setBusy(false);
    if (r.ok) close(); else setError(r.message);
  };
  const clear = async () => { setBusy(true); const r = await ctx.act({ type: 'clear_override', feedbackId: item!.id }); setBusy(false); if (r.ok) close(); };
  return (
    <Drawer open={!!item && !!t} onClose={close} title={item?.id ?? ''} sub={item ? `${item.accountName} · ${dateTime(item.receivedAt)}` : ''}
      footer={item && t && t.status !== 'rejected' ? (
        <>
          {override && <button type="button" className="btn" disabled={busy} onClick={clear}>Return to agent</button>}
          <button type="button" className="btn primary" disabled={busy || !themeId} onClick={submit}>Route</button>
        </>
      ) : undefined}>
      {item && t && (
        <>
          <blockquote style={{ margin: 0, fontSize: 16, lineHeight: '24px', color: 'var(--text-strong)' }}>“{item.text}”</blockquote>
          <dl className="kv">
            <dt>Account</dt><dd>{item.accountName} <span className="mono muted">{item.accountId}</span></dd>
            <dt>Segment and ARR</dt><dd>{SEGMENT_LABEL[item.segment]} · {money(item.arrUsd)}</dd>
            <dt>Channel</dt><dd>{CHANNEL_LABEL[item.channel]}</dd>
          </dl>
          <div className="panel">
            <h3>{t.by === 'human' ? 'Routing decision (person)' : 'Agent decision'}</h3>
            <div style={{ marginBottom: 8 }}><RouteChip t={t} /></div>
            <p style={{ margin: '0 0 8px' }} data-testid="rationale">{t.rationale}</p>
            {t.matched.length > 0 && <div className="kw">{t.matched.map((m) => <Chip key={m} tone="neu" dot={false}>{m}</Chip>)}</div>}
            {t.runnerUp && <p className="sub" style={{ margin: '8px 0 0' }}>Runner-up: {THEME_BY_ID.get(t.runnerUp.themeId)!.title} ({t.runnerUp.score})</p>}
          </div>
          {t.status !== 'rejected' && (
            <div className="stack">
              <h3 style={{ margin: 0 }}>{override ? 'Change routing' : t.status === 'routed' ? 'Override routing' : 'Route this item'}</h3>
              <label className="field">Theme and owner
                <select value={themeId} onChange={(e) => setThemeId(e.target.value)}>
                  <option value="">Choose a theme…</option>
                  {PRODUCT_AREAS.map((a) => (
                    <optgroup key={a} label={`${AREA_INFO[a].label} · ${AREA_INFO[a].owner}`}>
                      {THEMES.filter((x) => x.area === a).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="field">Note for the owner (required)
                <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} placeholder="Why this belongs there" />
              </label>
              {error && <div className="err" role="alert">{error}</div>}
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}

function ThemeDrawer({ ctx, t, onClose, onItem }: { ctx: Ctx; t: ThemeView | null; onClose: () => void; onItem: (id: string) => void }) {
  const segs = t ? ['enterprise', 'mid_market', 'smb'].map((s) => [s, new Set(t.feedbackIds.map((id) => ctx.state.feedback.find((f) => f.id === id)!).filter((f) => f.segment === s).map((f) => f.accountId)).size] as const) : [];
  return (
    <Drawer open={!!t} onClose={onClose} title={t?.title ?? ''} sub={t ? `${AREA_INFO[t.area].label} · owner ${AREA_INFO[t.area].owner}` : ''}>
      {t && (
        <>
          <div className="panel">
            <h3>Score</h3>
            {t.watchReason ? <p style={{ margin: 0 }}>{t.watchReason}</p> : (
              <p style={{ margin: 0 }} className="mono">{t.accounts} accounts × {(t.arrUsd / 1_000_000).toFixed(2)} $M ARR = {t.score.toFixed(1)} · rank #{t.rank}</p>
            )}
            <p className="sub" style={{ margin: '8px 0 0' }}>{segs.map(([s, n]) => `${SEGMENT_LABEL[s]} ${n}`).join(' · ')} accounts · {t.mentions} mentions</p>
          </div>
          <div>
            <h3>Brief for {AREA_INFO[t.area].owner}</h3>
            <p style={{ margin: 0 }}>{t.accounts} accounts worth {money(t.arrUsd)} ARR report “{t.title.toLowerCase()}”. {t.launchIds.length ? `In flight: ${t.launchIds.join(', ')}.` : 'No launch addresses this yet.'} {t.incidentIds.length ? `Related incidents: ${t.incidentIds.join(', ')}.` : ''}</p>
          </div>
          <div>
            <h3>Feedback ({t.feedbackIds.length})</h3>
            <ul className="feed">
              {t.feedbackIds.map((id) => {
                const f = ctx.state.feedback.find((x) => x.id === id)!;
                return <li key={id}><button type="button" className="rowbtn mono" onClick={() => onItem(id)}>{id}</button><span>{f.text}<div className="sub">{f.accountName} · {money(f.arrUsd)}</div></span></li>;
              })}
            </ul>
          </div>
        </>
      )}
    </Drawer>
  );
}

function Rules() {
  return (
    <>
      <p className="note-line">The triage agent is deterministic and explainable: each theme has weighted phrases. It routes when the best theme scores at least {ROUTE_THRESHOLD} and leads any theme in a different product area by at least {AMBIGUITY_MARGIN}; otherwise it hands the item to a person with its reasoning. Items under 12 characters are rejected. No model is called.</p>
      <div className="table-wrap">
        <table className="stack-sm">
          <thead><tr><th>Theme</th><th>Owner</th><th>Phrases and weights</th></tr></thead>
          <tbody>
            {THEMES.map((t) => (
              <tr key={t.id}>
                <td data-label="Theme">{t.title}<div className="sub mono">{t.id}</div></td>
                <td data-label="Owner">{AREA_INFO[t.area].label}<div className="sub">{AREA_INFO[t.area].owner}</div></td>
                <td data-label="Phrases"><span className="kw">{t.keywords.map(([k, w]) => <Chip key={k} tone="neu" dot={false}>{k} · {w}</Chip>)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ImportDrawer({ ctx, open, onClose }: { ctx: Ctx; open: boolean; onClose: () => void }) {
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const ids = useMemo(() => new Set(ctx.state.feedback.map((f) => f.id)), [ctx.state.feedback]);
  const check = csv.trim() ? validateImport(csv, ids, ctx.now) : null;
  const example = () => {
    let n = Math.max(...ctx.state.feedback.map((f) => Number(f.id.slice(3))));
    const at = (m: number) => new Date(ctx.now - m * 60_000).toISOString().slice(0, 19) + 'Z';
    const rows = [
      [`FB-${++n}`, at(40), 'support_ticket', 'ACC-2290', 'Oakridge Clinics', 'mid_market', '510000', 'Our virtual card was declined at a SaaS vendor during renewal again.'],
      [`FB-${++n}`, at(25), 'csm_call', 'ACC-2291', 'Pallas Freight', 'enterprise', '1450000', 'Approver is out of office and every bill is stuck in the approval chain.'],
      [`FB-${++n}`, at(10), 'in_app', 'ACC-2292', 'Quill Studio', 'smb', '52000', '"Hotel rebooking after the schedule change failed, had to call the hotel."'],
    ];
    setCsv([CSV_HEADER, ...rows.map((r) => r.join(','))].join('\n'));
    setServerError(null);
  };
  const close = () => { setCsv(''); setServerError(null); onClose(); };
  const submit = async () => {
    setBusy(true);
    const r = await ctx.act({ type: 'import_feedback', csv });
    setBusy(false);
    if (r.ok) close(); else setServerError(r.message);
  };
  return (
    <Drawer open={open} onClose={close} title="Import feedback" sub="CSV, up to 200 rows. One invalid row blocks the whole file."
      footer={<><button type="button" className="btn" onClick={example}>Load example rows</button><button type="button" className="btn primary" disabled={busy || !check || check.errors.length > 0} onClick={submit}>Import and triage</button></>}>
      <label className="field">CSV with header <span className="mono">{CSV_HEADER}</span>
        <textarea className="code" value={csv} onChange={(e) => { setCsv(e.target.value); setServerError(null); }} spellCheck={false} />
      </label>
      {check && check.errors.length > 0 && <div className="err" role="alert"><strong>Nothing will be imported.</strong><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{check.errors.slice(0, 10).map((e) => <li key={e}>{e}</li>)}</ul></div>}
      {check && check.errors.length === 0 && (
        <div className="ok" role="status">
          {plural(check.items.length, 'row')} valid. Agent preview:
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{check.items.map((i) => { const t = triage(i); return <li key={i.id}><span className="mono">{i.id}</span>: {t.status === 'routed' ? `${AREA_INFO[t.area!].label} · ${THEME_BY_ID.get(t.themeId!)!.title}` : t.status === 'needs_human' ? 'needs a person' : 'rejected'}</li>; })}</ul>
        </div>
      )}
      {serverError && <div className="err" role="alert">{serverError}</div>}
    </Drawer>
  );
}
