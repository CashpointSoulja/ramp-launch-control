import { DurableObject } from 'cloudflare:workers';
import { execute, freshEnvelope, isEnvelope, parseRequest, type Envelope } from './engine/workspace.ts';
import { CommandError } from './engine/commands.ts';

interface Env {
  ASSETS: Fetcher;
  WORKSPACE: DurableObjectNamespace<Workspace>;
}

const MAX_BODY_BYTES = 256 * 1024;
const COOKIE = 'rlc_visitor';
const SECURITY_HEADERS: Record<string, string> = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
};

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...SECURITY_HEADERS, ...extra } });
}
const err = (status: number, code: string, message: string, extra: Record<string, string> = {}) => json(status, { ok: false, code, message }, extra);

async function readBody(req: Request): Promise<string> {
  const declared = req.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) throw new CommandError(413, 'too_large', 'Request body is too large.');
  if (!req.body) throw new CommandError(400, 'empty_body', 'Request body is empty.');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new CommandError(413, 'too_large', 'Request body is too large.');
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    throw new CommandError(400, 'bad_encoding', 'Body must be valid UTF-8.');
  }
}

export class Workspace extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK (id = 1), body TEXT NOT NULL)');
  }

  private load(): Envelope {
    const row = this.ctx.storage.sql.exec<{ body: string }>('SELECT body FROM workspace WHERE id = 1').toArray()[0];
    if (row) {
      try {
        const parsed: unknown = JSON.parse(row.body);
        if (isEnvelope(parsed)) return parsed;
      } catch { /* fall through to reseed */ }
    }
    const env = freshEnvelope(Date.now());
    this.save(env);
    return env;
  }

  private save(env: Envelope) {
    this.ctx.storage.sql.exec('INSERT INTO workspace (id, body) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET body = excluded.body', JSON.stringify(env));
  }

  getState() {
    const env = this.load();
    return { ok: true, revision: env.revision, epoch: env.epoch, serverNow: new Date().toISOString(), state: env.state };
  }

  command(raw: unknown) {
    const env = this.load();
    const { envelope, response } = execute(env, parseRequest(raw), Date.now());
    if (response.ok && !response.replayed) this.save(envelope);
    return response;
  }
}

function visitorId(req: Request): { id: string; setCookie: string | null } {
  const m = /(?:^|;\s*)rlc_visitor=([a-f0-9]{32})(?:;|$)/.exec(req.headers.get('cookie') ?? '');
  if (m) return { id: m[1], setCookie: null };
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const id = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return { id, setCookie: `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}` };
}

function sameOrigin(req: Request): boolean {
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) return false;
  return true;
}

async function handleApi(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const route = url.pathname;
  const methods: Record<string, string> = { '/api/health': 'GET', '/api/state': 'GET', '/api/command': 'POST' };
  const allowed = methods[route];
  if (!allowed) return err(404, 'not_found', 'Unknown API route.');
  if (req.method !== allowed && !(allowed === 'GET' && req.method === 'HEAD')) return err(405, 'method_not_allowed', `Use ${allowed}.`, { allow: allowed });
  if (route === '/api/health') return json(200, { ok: true, mode: 'worker', storage: 'durable-object-sqlite' });

  const { id, setCookie } = visitorId(req);
  const extra: Record<string, string> = setCookie ? { 'set-cookie': setCookie } : {};
  const stub = env.WORKSPACE.get(env.WORKSPACE.idFromName(id));
  if (route === '/api/state') return json(200, await stub.getState(), extra);

  if (!sameOrigin(req)) return err(403, 'cross_origin', 'Cross-origin writes are refused.', extra);
  const ct = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (ct !== 'application/json') return err(415, 'unsupported_media_type', 'Send application/json.', extra);
  let parsed: unknown;
  try {
    const text = await readBody(req);
    try {
      parsed = JSON.parse(text);
    } catch {
      return err(400, 'bad_json', 'Body is not valid JSON.', extra);
    }
  } catch (e) {
    if (e instanceof CommandError) return err(e.status, e.code, e.message, extra);
    throw e;
  }
  try {
    const res = await stub.command(parsed);
    return json(res.status, res, extra);
  } catch (e) {
    const ce = e as { status?: number; code?: string; message?: string };
    if (typeof ce.status === 'number' && typeof ce.code === 'string') return err(ce.status, ce.code, ce.message ?? 'Refused.', extra);
    return err(500, 'internal', 'Something went wrong; no change was saved.', extra);
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) return handleApi(req, env);
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
