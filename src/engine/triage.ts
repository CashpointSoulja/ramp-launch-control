import { THEMES, THEME_BY_ID, ROUTE_THRESHOLD, AMBIGUITY_MARGIN } from './themes.ts';
import { AREA_INFO, type FeedbackItem, type Override, type Triage } from './types.ts';

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const patternCache = new Map<string, RegExp>();
function phrase(p: string): RegExp {
  let re = patternCache.get(p);
  if (!re) {
    re = new RegExp(`(^|[^a-z0-9])${escapeRe(p)}([^a-z0-9]|$)`, 'i');
    patternCache.set(p, re);
  }
  return re;
}

export interface ThemeScore { themeId: string; score: number; matched: string[] }

export function scoreText(text: string): ThemeScore[] {
  const lower = text.toLowerCase();
  return THEMES.map((t) => {
    const matched: string[] = [];
    let score = 0;
    for (const [kw, w] of t.keywords) {
      if (phrase(kw).test(lower)) {
        matched.push(kw);
        score += w;
      }
    }
    return { themeId: t.id, score, matched };
  }).sort((a, b) => b.score - a.score || a.themeId.localeCompare(b.themeId));
}

/** Deterministic triage agent: keyword evidence per theme, a routing threshold and an ambiguity margin. No model call. */
export function triage(item: FeedbackItem, override?: Override): Triage {
  const text = item.text.trim();
  if (text.length < 12) {
    return { feedbackId: item.id, status: 'rejected', themeId: null, area: null, by: 'agent', score: 0, runnerUp: null, matched: [], rationale: `Rejected: ${text.length} characters is too short to triage (minimum 12). Ask the submitter for the workflow and what went wrong.` };
  }
  const scores = scoreText(text);
  const [top, second] = scores;
  const topTheme = THEME_BY_ID.get(top.themeId)!;
  const runnerUp = second && second.score > 0 ? { themeId: second.themeId, score: second.score } : null;

  if (override) {
    const t = THEME_BY_ID.get(override.themeId)!;
    return { feedbackId: item.id, status: 'routed', themeId: t.id, area: t.area, by: 'human', score: top.score, runnerUp, matched: top.matched, rationale: `Routed by a person to ${AREA_INFO[t.area].label} as "${t.title}". Note: ${override.note}` };
  }
  if (top.score < ROUTE_THRESHOLD) {
    const hint = top.score > 0 ? ` Strongest signal was "${topTheme.title}" at ${top.score} (${top.matched.map((m) => `"${m}"`).join(', ')}).` : ' No theme keywords matched.';
    return { feedbackId: item.id, status: 'needs_human', themeId: null, area: null, by: 'agent', score: top.score, runnerUp, matched: top.matched, rationale: `Needs a person: no theme reached the routing threshold of ${ROUTE_THRESHOLD}.${hint}` };
  }
  const secondTheme = second ? THEME_BY_ID.get(second.themeId)! : null;
  if (second && secondTheme && top.score - second.score < AMBIGUITY_MARGIN && secondTheme.area !== topTheme.area) {
    return { feedbackId: item.id, status: 'needs_human', themeId: null, area: null, by: 'agent', score: top.score, runnerUp, matched: [...top.matched, ...second.matched], rationale: `Needs a person: ambiguous between "${topTheme.title}" (${AREA_INFO[topTheme.area].label}, ${top.score}) and "${secondTheme.title}" (${AREA_INFO[secondTheme.area].label}, ${second.score}); the margin is under ${AMBIGUITY_MARGIN}, so the agent will not pick an owner.` };
  }
  const vs = second && second.score > 0 ? `next best "${secondTheme!.title}" scored ${second.score}` : 'no other theme matched';
  return {
    feedbackId: item.id, status: 'routed', themeId: topTheme.id, area: topTheme.area, by: 'agent', score: top.score, runnerUp, matched: top.matched,
    rationale: `Routed to ${AREA_INFO[topTheme.area].label} (${AREA_INFO[topTheme.area].owner}) as "${topTheme.title}": matched ${top.matched.map((m) => `"${m}"`).join(', ')} for a score of ${top.score}; ${vs}.`,
  };
}
