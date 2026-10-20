import { THEMES, MIN_ACCOUNTS_TO_RANK } from './themes.ts';
import { triage } from './triage.ts';
import type { ProductArea, Triage, WorkspaceState } from './types.ts';
import { fnv1a } from './util.ts';

export interface ThemeView {
  themeId: string;
  area: ProductArea;
  title: string;
  mentions: number;
  accounts: number;
  arrUsd: number;
  score: number;
  rank: number | null;
  watchReason: string | null;
  feedbackIds: string[];
  fingerprint: string;
  handoff: 'none' | 'current' | 'stale';
  newSinceHandoff: number;
  incidentIds: string[];
  launchIds: string[];
}

export interface VoiceView {
  triage: Triage[];
  themes: ThemeView[];
  totals: { items: number; routed: number; needsHuman: number; rejected: number; byHuman: number; accounts: number; arrUsd: number };
}

export function themeScore(accounts: number, arrUsd: number): number {
  return Math.round(accounts * (arrUsd / 1_000_000) * 10) / 10;
}

export function buildVoice(state: WorkspaceState): VoiceView {
  const tri = state.feedback.map((f) => triage(f, state.overrides[f.id]));
  const byId = new Map(state.feedback.map((f) => [f.id, f]));
  const latestArr = (rows: string[]) => {
    const m = new Map<string, { at: string; arr: number }>();
    for (const id of rows) {
      const f = byId.get(id)!;
      const cur = m.get(f.accountId);
      if (!cur || f.receivedAt > cur.at) m.set(f.accountId, { at: f.receivedAt, arr: f.arrUsd });
    }
    return m;
  };
  const themes: ThemeView[] = THEMES.map((th) => {
    const ids = tri.filter((x) => x.status === 'routed' && x.themeId === th.id).map((x) => x.feedbackId).sort();
    const accts = latestArr(ids);
    const arr = [...accts.values()].reduce((s, a) => s + a.arr, 0);
    const fingerprint = fnv1a(ids.join(','));
    const h = state.handoffs[th.id];
    return {
      themeId: th.id, area: th.area, title: th.title, mentions: ids.length, accounts: accts.size, arrUsd: arr,
      score: themeScore(accts.size, arr), rank: null,
      watchReason: accts.size < MIN_ACCOUNTS_TO_RANK ? (ids.length >= MIN_ACCOUNTS_TO_RANK ? `${ids.length} mentions but only ${accts.size} account${accts.size === 1 ? '' : 's'}: not ranked until ${MIN_ACCOUNTS_TO_RANK} accounts.` : `${accts.size} account${accts.size === 1 ? '' : 's'}: watch until ${MIN_ACCOUNTS_TO_RANK} accounts.`) : null,
      feedbackIds: ids, fingerprint,
      handoff: !h ? 'none' : h.fingerprint === fingerprint ? 'current' : 'stale',
      newSinceHandoff: h ? ids.filter((id) => !h.feedbackIds.includes(id)).length : 0,
      incidentIds: state.incidents.filter((i) => i.linkedThemeId === th.id).map((i) => i.id),
      launchIds: state.launches.filter((l) => l.linkedThemeIds.includes(th.id)).map((l) => l.id),
    };
  });
  const ranked = themes.filter((t) => t.watchReason === null).sort((a, b) => b.score - a.score || b.accounts - a.accounts || a.themeId.localeCompare(b.themeId));
  ranked.forEach((t, i) => (t.rank = i + 1));
  const ordered = [...ranked, ...themes.filter((t) => t.watchReason !== null).sort((a, b) => b.mentions - a.mentions || a.themeId.localeCompare(b.themeId))];
  const valid = tri.filter((x) => x.status !== 'rejected').map((x) => x.feedbackId);
  const allAccts = latestArr(valid);
  return {
    triage: tri,
    themes: ordered,
    totals: {
      items: tri.length,
      routed: tri.filter((x) => x.status === 'routed').length,
      needsHuman: tri.filter((x) => x.status === 'needs_human').length,
      rejected: tri.filter((x) => x.status === 'rejected').length,
      byHuman: tri.filter((x) => x.by === 'human').length,
      accounts: allAccts.size,
      arrUsd: [...allAccts.values()].reduce((s, a) => s + a.arr, 0),
    },
  };
}
