import { execute, freshEnvelope, isEnvelope, type Envelope, type ExecuteResponse } from '../src/engine/workspace.ts';
import type { WorkspaceState } from '../src/engine/types.ts';

export type Mode = 'worker' | 'browser';
export interface Snapshot { revision: number; epoch: number; state: WorkspaceState; mode: Mode }
export type SendResult = { ok: true; message: string; extra: Record<string, unknown> } | { ok: false; code: string; message: string };

export interface Backend {
  mode: Mode;
  load(): Promise<Snapshot>;
  send(command: Record<string, unknown>, expectedRevision: number): Promise<SendResult>;
}

const key = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

function toResult(r: ExecuteResponse | { ok: false; code: string; message: string }): SendResult {
  if (r.ok) {
    const { message, ...extra } = r.result;
    return { ok: true, message, extra };
  }
  return { ok: false, code: r.code, message: r.message };
}

const workerBackend: Backend = {
  mode: 'worker',
  async load() {
    const res = await fetch('/api/state', { credentials: 'same-origin', headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`Workspace did not load (HTTP ${res.status}).`);
    const body = (await res.json()) as { revision: number; epoch: number; state: WorkspaceState };
    return { revision: body.revision, epoch: body.epoch, state: body.state, mode: 'worker' };
  },
  async send(command, expectedRevision) {
    try {
      const res = await fetch('/api/command', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ command, idempotencyKey: key(), expectedRevision }),
      });
      const body = (await res.json().catch(() => null)) as ExecuteResponse | null;
      if (!body) return { ok: false, code: 'bad_response', message: `Server replied HTTP ${res.status} without a readable body. Nothing was changed.` };
      return toResult(body);
    } catch {
      return { ok: false, code: 'network', message: 'Network error: the change was not confirmed. Refresh to see the saved state.' };
    }
  },
};

const STORE = 'ramp-launch-control:v1';
function readLocal(): Envelope {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isEnvelope(parsed)) return parsed;
    }
  } catch { /* reseed below */ }
  const env = freshEnvelope(Date.now());
  localStorage.setItem(STORE, JSON.stringify(env));
  return env;
}

const browserBackend: Backend = {
  mode: 'browser',
  async load() {
    const env = readLocal();
    return { revision: env.revision, epoch: env.epoch, state: env.state, mode: 'browser' };
  },
  async send(command, expectedRevision) {
    const env = readLocal();
    const { envelope, response } = execute(env, { command, idempotencyKey: key(), expectedRevision }, Date.now());
    if (response.ok && !response.replayed) {
      try {
        localStorage.setItem(STORE, JSON.stringify(envelope));
      } catch {
        return { ok: false, code: 'storage_full', message: 'Browser storage is full; the change was not saved.' };
      }
    }
    return toResult(response);
  },
};

export const backend: Backend = __STATIC_MODE__ ? browserBackend : workerBackend;
