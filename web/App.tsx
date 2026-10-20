import { useCallback, useEffect, useMemo, useState } from 'react';
import { backend, type SendResult, type Snapshot } from './api.ts';
import { buildVoice } from '../src/engine/voice.ts';
import { evaluateLaunch } from '../src/engine/launch.ts';
import { evaluateIncident, summarizeIncidents } from '../src/engine/incidents.ts';
import { AREA_INFO } from '../src/engine/types.ts';
import { THEME_BY_ID } from '../src/engine/themes.ts';
import { Chip, SevChip, StatusChip, VerdictChip, type Ctx } from './ui.tsx';
import { ago, money, plural } from './format.ts';
import { VoicePage } from './Voice.tsx';
import { LaunchesPage } from './Launches.tsx';
import { IncidentsPage } from './Incidents.tsx';

const REPO = 'https://github.com/CashpointSoulja/ramp-launch-control';
const LOGO = './brand/ramp-wordmark.svg';
const LOGO_WHITE = './brand/ramp-wordmark-white.svg';

function useHashRoute(): string[] {
  const read = () => (location.hash.replace(/^#\/?/, '') || 'overview').split('/');
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function App() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<{ text: string; bad: boolean } | null>(null);
  const [menu, setMenu] = useState(false);
  const route = useHashRoute();

  const reload = useCallback(async () => {
    try {
      setSnap(await backend.load());
      setNow(Date.now());
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { setMenu(false); }, [route.join('/')]);

  const act = useCallback(async (cmd: Record<string, unknown>): Promise<SendResult> => {
    if (!snap) return { ok: false, code: 'not_loaded', message: 'Workspace not loaded yet.' };
    const r = await backend.send(cmd, snap.revision);
    setToast({ text: r.message, bad: !r.ok });
    await reload();
    return r;
  }, [snap, reload]);

  const ctx: Ctx | null = useMemo(() => {
    if (!snap) return null;
    const s = snap.state;
    return {
      state: s, now, mode: snap.mode, act,
      voice: buildVoice(s),
      launchEval: Object.fromEntries(s.launches.map((l) => [l.id, evaluateLaunch(l, s.incidents, now)])),
      incidentEval: Object.fromEntries(s.incidents.map((i) => [i.id, evaluateIncident(i, s.incidents, now)])),
      incidentSummary: summarizeIncidents(s.incidents, now),
    };
  }, [snap, now, act]);

  const page = route[0];
  const nav = ctx ? [
    { id: 'overview', label: 'Overview', count: undefined as number | undefined },
    { id: 'voice', label: 'Customer voice', count: ctx.voice.totals.needsHuman },
    { id: 'launches', label: 'Launches', count: Object.values(ctx.launchEval).filter((e) => e.verdict === 'no_go').length },
    { id: 'incidents', label: 'Incidents', count: ctx.incidentSummary.open },
  ] : [];

  const reset = async () => {
    if (!window.confirm('Reset this workspace to fresh sample data? Your changes here will be cleared.')) return;
    await act({ type: 'reset' });
    location.hash = '#/';
  };

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="appbar">
        <a href="#/" aria-label="Ramp Launch Control home"><img src={LOGO_WHITE} alt="Ramp" width={74} height={20} /></a>
        <button type="button" aria-expanded={menu} aria-controls="sidenav" onClick={() => setMenu((m) => !m)}>{menu ? 'Close' : 'Menu'}</button>
      </header>
      <div className="shell">
        <aside className={`side${menu ? ' open' : ''}`} id="sidenav" aria-label="Primary">
          <a className="brand" href="#/" aria-label="Ramp Launch Control home">
            <img src={LOGO} alt="Ramp" width={81} height={22} />
            <span className="brand-sub">Launch<br />Control</span>
          </a>
          <nav className="nav">
            {nav.map((n) => (
              <a key={n.id} href={`#/${n.id === 'overview' ? '' : n.id}`} aria-current={page === n.id ? 'page' : undefined}>
                <span>{n.label}</span>
                {n.count !== undefined && n.count > 0 && <span className="count" aria-label={`${n.count} need attention`}>{n.count}</span>}
              </a>
            ))}
            <div className="nav-sep" />
            <a href={`${REPO}#readme`} target="_blank" rel="noreferrer">Docs and source <span aria-hidden="true">↗</span></a>
          </nav>
          <div className="side-foot">
            {ctx && (
              <span className="mode-pill" data-testid="mode"><span className="dot" aria-hidden="true" style={{ color: '#1F5F3A' }} />
                {ctx.mode === 'worker' ? 'Saved to your server workspace' : 'Saved in this browser'}
              </span>
            )}
            <button type="button" className="linkbtn" onClick={reset} style={{ textAlign: 'left', color: 'var(--muted)' }}>Reset sample data</button>
          </div>
        </aside>
        <div className="main">
          <main id="main" className="content" tabIndex={-1}>
            {loadError && <div className="err" role="alert">{loadError} <button className="linkbtn" type="button" onClick={reload}>Retry</button></div>}
            {!ctx && !loadError && <p className="muted" role="status">Loading workspace…</p>}
            {ctx && page === 'overview' && <Overview ctx={ctx} />}
            {ctx && page === 'voice' && <VoicePage ctx={ctx} />}
            {ctx && page === 'launches' && <LaunchesPage ctx={ctx} id={route[1]} />}
            {ctx && page === 'incidents' && <IncidentsPage ctx={ctx} id={route[1]} />}
            {ctx && !['overview', 'voice', 'launches', 'incidents'].includes(page) && (
              <div><h1>Page not found</h1><p><a href="#/">Back to overview</a></p></div>
            )}
          </main>
          <footer className="footer">Independent concept by Ayo Ahmed. Not affiliated with Ramp; the Ramp name and wordmark belong to Ramp.</footer>
        </div>
      </div>
      <div aria-live="polite" role="status" className="sr-only">{toast?.text ?? ''}</div>
      {toast && <div className={`toast${toast.bad ? ' bad' : ''}`} data-testid="toast">{toast.text}</div>}
    </>
  );
}

function Overview({ ctx }: { ctx: Ctx }) {
  const { voice, state, launchEval, incidentSummary: inc } = ctx;
  const top = voice.themes.find((t) => t.rank === 1);
  const evals = Object.values(launchEval);
  const go = evals.filter((e) => e.verdict === 'go').length;
  const hold = evals.filter((e) => e.verdict === 'hold').length;
  const nogo = evals.filter((e) => e.verdict === 'no_go').length;
  const atRisk = Object.values(ctx.incidentEval).filter((e) => e.slaState === 'at_risk' || (e.slaState === 'breached' && e.ttrHours === null)).length;
  const overdue = Object.values(ctx.incidentEval).filter((e) => e.pirState === 'overdue').length;

  const chains = state.launches.map((l) => {
    const themeId = l.linkedThemeIds[0];
    const theme = voice.themes.find((t) => t.themeId === themeId)!;
    const linked = state.incidents.filter((i) => i.linkedLaunchId === l.id || i.linkedThemeId === themeId);
    const incident = linked.find((i) => i.status !== 'resolved') ?? linked.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))[0];
    return { l, theme, incident, ev: launchEval[l.id] };
  });

  return (
    <>
      <p className="crumb">Product Operations</p>
      <div className="page-head"><h1>Launch Control<span className="muted">{AREA_INFO.cards.label}, {AREA_INFO.expenses.label}, {AREA_INFO.billpay.label}, {AREA_INFO.travel.label}</span></h1></div>
      <section className="framing" aria-label="Why this exists">
        <p className="kicker">From Ayo Ahmed</p>
        <ol>
          <li className="lead">I read the Product Operations role. Launches fail in the gaps between teams - voice of the customer gets lost, enablement lands late, incidents repeat.</li>
          <li className="dim">I've run this before: product ops at Corgi, then founded my own company and ran its operations end to end.</li>
          <li className="lead">This is what I built for you: the connective tissue - feedback triaged by an agent, launches with real gates, incidents with root causes.</li>
        </ol>
      </section>
      <p className="sample-line" data-testid="sample-line">Sample data: {voice.totals.items} synthetic feedback items from {voice.totals.accounts} accounts, {state.launches.length} launches and {state.incidents.length} incidents. No real Ramp customers or systems.</p>

      <div className="kpis">
        <a className="kpi" href="#/voice">
          <div className="label">Feedback routed by the agent</div>
          <div className="value">{voice.totals.routed - voice.totals.byHuman} of {voice.totals.items}</div>
          <div className="note">{plural(voice.totals.needsHuman, 'item')} need a person · {voice.totals.rejected} rejected</div>
        </a>
        <a className="kpi" href="#/voice">
          <div className="label">Top theme score</div>
          <div className="value">{top ? top.score.toFixed(1) : '—'}</div>
          <div className="note">{top ? `${top.title} · ${top.accounts} accounts · ${money(top.arrUsd)} ARR` : 'No theme has 3 accounts yet'}</div>
        </a>
        <a className="kpi" href="#/launches">
          <div className="label">Launches cleared to GO</div>
          <div className="value">{go} of {evals.length}</div>
          <div className="note">{hold} on hold · {nogo} blocked</div>
        </a>
        <a className="kpi" href="#/incidents">
          <div className="label">Open incidents</div>
          <div className="value">{inc.open}</div>
          <div className="note">{atRisk} near or past SLA · {overdue} reviews overdue</div>
        </a>
      </div>

      <div className="grid2">
        <section aria-labelledby="chains-h">
          <h2 id="chains-h">Connective tissue</h2>
          <p className="note-line">Each launch traced to the customer theme it answers and the incident that touches it.</p>
          <div style={{ borderTop: '1px solid var(--rule)' }}>
            {chains.map(({ l, theme, incident, ev }) => (
              <div className="chain" key={l.id}>
                <a className="node" href="#/voice">
                  <span className="sub">Customer voice · {theme.rank ? `#${theme.rank}` : 'Watch'}</span>
                  <strong>{THEME_BY_ID.get(theme.themeId)!.title}</strong>
                  <span className="sub">{theme.accounts} accounts · {money(theme.arrUsd)} · score {theme.score.toFixed(1)}</span>
                </a>
                <span className="link" aria-hidden="true">→</span>
                {incident ? (
                  <a className="node" href={`#/incidents/${incident.id}`}>
                    <span className="sub mono">{incident.id}</span>
                    <strong>{incident.title}</strong>
                    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><SevChip s={incident.severity} /><StatusChip s={incident.status} /></span>
                  </a>
                ) : <span className="node sub">No linked incident</span>}
                <span className="link" aria-hidden="true">→</span>
                <a className="node" href={`#/launches/${l.id}`}>
                  <span className="sub mono">{l.id} · {AREA_INFO[l.area].label}</span>
                  <strong>{l.name}</strong>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><VerdictChip v={ev.verdict} />{ev.verdict === 'no_go' && <span className="sub">{ev.blockers.length} blocker{ev.blockers.length === 1 ? '' : 's'}</span>}</span>
                </a>
              </div>
            ))}
          </div>
        </section>
        <section aria-labelledby="act-h">
          <h2 id="act-h">Activity</h2>
          <p className="note-line">Latest changes in this workspace.</p>
          <ul className="feed">
            {state.activity.slice(0, 9).map((a, i) => (
              <li key={i}><span className="muted">{ago(a.at, ctx.now)}</span><span>{a.text}</span></li>
            ))}
          </ul>
          {inc.repeats > 0 && <p className="sub" style={{ marginTop: 12 }}><Chip tone="cau">Repeat</Chip> {plural(inc.repeats, 'incident')} share a root cause with an earlier incident in the same area within 60 days.</p>}
        </section>
      </div>
    </>
  );
}
