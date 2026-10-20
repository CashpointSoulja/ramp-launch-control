# AGENTS.md

Guidance for anyone (person or automated contributor) changing this repository.

## Layout

- `src/engine/` — all product logic, pure TypeScript, no I/O. Triage (`triage.ts`, `themes.ts`), scoring (`voice.ts`), launch gates (`launch.ts`), incidents and reviews (`incidents.ts`), CSV import (`csv.ts`), command validation (`commands.ts`), the single write path (`workspace.ts`) and synthetic data (`seed.ts`).
- `src/worker.ts` — Cloudflare Worker and the per-visitor SQLite Durable Object. Only `default` and `Workspace` may be exported from this module.
- `web/` — React UI. `api.ts` picks the Worker backend or the in-browser fallback (`__STATIC_MODE__`).
- `test/` unit tests, `eval/` deterministic evals with a held-out set, `scripts/` API and browser checks.

## Rules

1. Every state change goes through `POST /api/command` → `execute()`. Add a command by extending `SPECS` and `applyCommand` in `commands.ts`; unknown fields are refused.
2. Gates fail closed. If a rule can't be evaluated, the answer is HOLD or NO-GO, never GO.
3. Business-rule refusals are `CommandError(422, code, reason)`; conflicts are 409. The reason is shown to the user verbatim, so write it for them.
4. The triage agent must explain itself (matched phrases, score, runner-up) and must be able to abstain. Don't tune keyword lists against `eval/run.ts` held-out cases; add new held-out cases instead.
5. All data is synthetic. Don't add real company, customer or Ramp-internal data.
6. Keep the Ramp tokens in `DESIGN.md` and `web/styles.css` in sync. Check every UI change at 1366px and 390px.
7. Node's strip-only TypeScript loader runs the evals: no parameter properties, enums or namespaces in `src/engine`.

## Before opening a PR

```bash
npm ci
npm run check            # typecheck, unit tests, evals, build, wrangler dry run
npm run dev &            # Worker on :8787
npm run test:api
npm run ui:check         # Playwright + axe, writes docs/screenshots
```
