// API boundary checks against a running Worker (default http://localhost:8787).
const BASE = process.argv[2] || process.env.BASE || 'http://localhost:8787';
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const origin = new URL(BASE).origin;

const h = await fetch(`${BASE}/api/health`);
check('health 200', h.status === 200);
check('security headers', h.headers.get('x-content-type-options') === 'nosniff' && h.headers.get('cache-control')?.includes('no-store'));

const s1 = await fetch(`${BASE}/api/state`);
const cookie = (s1.headers.get('set-cookie') || '').split(';')[0];
check('visitor cookie issued HttpOnly', /^rlc_visitor=[0-9a-f]{32}$/.test(cookie) && /HttpOnly/i.test(s1.headers.get('set-cookie') || ''));
let st = await s1.json();
check('fresh workspace seeded', st.revision >= 1 && st.state.feedback.length >= 40, `${st.state.feedback.length} items`);

const post = (body, headers = {}) => fetch(`${BASE}/api/command`, { method: 'POST', headers: { cookie, origin, 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const key = () => `chk-${Math.random().toString(36).slice(2, 12)}`;

const reset = await post({ command: { type: 'reset' }, idempotencyKey: key(), expectedRevision: st.revision });
check('reset 200', reset.status === 200);
st = await (await fetch(`${BASE}/api/state`, { headers: { cookie } })).json();

check('cross-origin write 403', (await post({}, { origin: 'https://evil.example' })).status === 403);
check('wrong content-type 415', (await post('{}', { 'content-type': 'text/plain' })).status === 415);
check('bad JSON 400', (await post('{nope')).status === 400);
check('invalid UTF-8 400', (await fetch(`${BASE}/api/command`, { method: 'POST', headers: { cookie, origin, 'content-type': 'application/json' }, body: new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]) })).status === 400);
check('oversized body 413', (await post('x'.repeat(300 * 1024))).status === 413);
check('unknown command 400', (await post({ command: { type: 'drop_tables' }, idempotencyKey: key(), expectedRevision: st.revision })).status === 400);
check('unknown route 404', (await fetch(`${BASE}/api/nope`)).status === 404);
check('GET on command 405', (await fetch(`${BASE}/api/command`)).status === 405);

const k = key();
const cmd = { type: 'post_update', incidentId: 'INC-2217', text: 'Template fix in review.' };
const a = await post({ command: cmd, idempotencyKey: k, expectedRevision: st.revision });
const aj = await a.json();
check('command applies', a.status === 200 && aj.revision === st.revision + 1);
const b = await (await post({ command: cmd, idempotencyKey: k, expectedRevision: st.revision })).json();
check('retry replays, no second write', b.replayed === true && b.revision === aj.revision);
check('key reuse for other command 409', (await post({ command: { ...cmd, text: 'A different update.' }, idempotencyKey: k, expectedRevision: aj.revision })).status === 409);
check('stale revision 409', (await post({ command: { ...cmd, text: 'A different update.' }, idempotencyKey: key(), expectedRevision: st.revision })).status === 409);
check('GO refused while gate is NO-GO 422', (await post({ command: { type: 'record_decision', launchId: 'LCH-303', verdict: 'go', note: 'Ship anyway' }, idempotencyKey: key(), expectedRevision: aj.revision })).status === 422);

const other = await fetch(`${BASE}/api/state`);
const oj = await other.json();
check('second visitor gets an isolated workspace', oj.revision === 1 && (other.headers.get('set-cookie') || '').split(';')[0] !== cookie);

const persisted = await (await fetch(`${BASE}/api/state`, { headers: { cookie } })).json();
check('write persisted', persisted.revision === aj.revision);
await post({ command: { type: 'reset' }, idempotencyKey: key(), expectedRevision: persisted.revision });

console.log(failed ? `${failed} API check(s) failed` : 'all API checks passed');
process.exit(failed ? 1 : 0);
