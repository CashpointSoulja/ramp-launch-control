// Browser check: every route at desktop and 390px, axe (serious/critical), console and HTTP errors,
// logo top-left, sample-data line, and one end-to-end flow per module. Screenshots go to docs/screenshots.
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || process.env.BASE || 'http://localhost:8787';
const OUT = process.env.OUT || 'docs/screenshots';
mkdirSync(OUT, { recursive: true });
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const ROUTES = [['overview', ''], ['voice', 'voice'], ['launches', 'launches'], ['launch-blocked', 'launches/LCH-303'], ['incidents', 'incidents'], ['incident-closed', 'incidents/INC-2207']];

const browser = await chromium.launch();
for (const [w, h, tag] of [[1366, 900, 'desktop'], [390, 844, 'mobile']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, bypassCSP: true });
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('response', (r) => r.status() >= 400 && problems.push(`${r.status()} ${r.url()}`));
  for (const [name, path] of ROUTES) {
    await page.goto(`${BASE}/#/${path}`);
    await page.locator('h1').first().waitFor();
    await page.waitForTimeout(300);
    const axe = await new AxeBuilder({ page }).analyze();
    const bad = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    check(`${tag} ${name}: axe serious/critical = 0`, bad.length === 0, bad.map((v) => `${v.id}×${v.nodes.length}`).join(', '));
    await page.screenshot({ path: `${OUT}/${tag}-${name}.png` });
  }
  await page.goto(`${BASE}/#/`);
  const logo = page.locator('img[alt="Ramp"]:visible').first();
  const box = await logo.boundingBox();
  check(`${tag}: Ramp wordmark top-left`, !!box && box.x < 40 && box.y < 50, box ? `${Math.round(box.x)},${Math.round(box.y)}` : 'missing');
  check(`${tag}: one sample-data line`, (await page.getByTestId('sample-line').count()) === 1);
  check(`${tag}: no demo banner`, !/demo mode|this is a demo/i.test(await page.locator('body').innerText()));
  const fav = await page.request.get(`${BASE}/favicon.ico`);
  check(`${tag}: favicon 200`, fav.status() === 200);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${tag}: no horizontal overflow`, overflow <= 0, `${overflow}px`);
  check(`${tag}: no console or HTTP errors`, problems.length === 0, problems.slice(0, 3).join(' | '));
  await ctx.close();
}

// End-to-end flows on a fresh workspace (desktop).
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();
page.on('dialog', (d) => d.accept());
await page.goto(`${BASE}/#/`);
await page.getByRole('button', { name: 'Reset sample data' }).click();
await page.waitForTimeout(600);

await page.goto(`${BASE}/#/voice`);
await page.getByRole('tab', { name: /Not routed/ }).click();
const before = await page.getByRole('tab', { name: /Not routed/ }).innerText();
await page.locator('#voice-panel tr', { hasText: 'Needs a person' }).first().locator('button.rowbtn').click();
await page.getByLabel('Theme and owner').selectOption({ index: 1 });
await page.getByLabel(/Note for the owner/).fill('Confirmed with the account manager on a call.');
await page.getByRole('button', { name: 'Route', exact: true }).click();
await page.waitForTimeout(500);
const after = await page.getByRole('tab', { name: /Not routed/ }).innerText();
check('voice: manual route clears an item from the queue', before !== after, `${before.replace(/\s+/g, ' ')} → ${after.replace(/\s+/g, ' ')}`);

await page.goto(`${BASE}/#/launches/LCH-303`);
check('launch: GO button disabled while NO-GO', await page.getByRole('button', { name: 'Record GO' }).isDisabled());
await page.goto(`${BASE}/#/incidents/INC-2214`);
await page.getByRole('button', { name: 'Resolve' }).click();
await page.getByLabel(/Root-cause category/).selectOption('config_change');
await page.getByLabel(/Root-cause note/).fill('MCC table refresh dropped SaaS merchant codes from the allowlist.');
await page.getByRole('button', { name: 'Resolve incident' }).click();
await page.waitForTimeout(500);
check('incident: resolve opens the post-incident review', await page.getByRole('heading', { name: /Post-incident review/ }).isVisible());
await page.goto(`${BASE}/#/launches/LCH-303`);
const verdict = await page.getByTestId('verdict').innerText();
check('launch: resolving INC-2214 removes it as a blocker', !/INC-2214 \(SEV-2\) is open/.test(verdict));
await page.reload();
check('persistence: resolved state survives reload', !/INC-2214 \(SEV-2\) is open/.test(await page.getByTestId('verdict').innerText()));
await page.goto(`${BASE}/#/`);
await page.getByRole('button', { name: 'Reset sample data' }).click();
await page.waitForTimeout(500);
await browser.close();
console.log(failed ? `${failed} UI check(s) failed` : 'all UI checks passed');
process.exit(failed ? 1 : 0);
