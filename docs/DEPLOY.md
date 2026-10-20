# Deploying

## Cloudflare Workers (primary)

The Worker serves the built assets and the API, with one SQLite Durable Object per visitor.

```bash
npm ci
npm run build
npx wrangler login
npx wrangler deploy
```

Or connect the repository in the Cloudflare dashboard (Workers & Pages → Create → Import a repository):

| Setting | Value |
| --- | --- |
| Build command | `npm ci && npm run build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |

`wrangler.jsonc` declares the `WORKSPACE` Durable Object and its `v1` SQLite migration; no secrets or environment variables are needed. Durable Objects with SQLite storage are available on the Workers free plan.

After deploying, check:

```bash
curl https://<your-worker>.workers.dev/api/health
node scripts/api-check.mjs https://<your-worker>.workers.dev
node scripts/ui-check.mjs https://<your-worker>.workers.dev
```

## GitHub Pages (fallback)

`npm run build:static` builds with relative paths and runs the same engine in the browser, saving to localStorage. The **GitHub Pages (static fallback)** workflow builds and publishes it when run manually (Actions → GitHub Pages → Run workflow), after Pages is set to "GitHub Actions" in the repository settings.

In this mode each browser keeps its own workspace; the UI shows "Saved in this browser".
