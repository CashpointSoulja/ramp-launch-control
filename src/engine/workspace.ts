import { applyCommand, CommandError, parseCommand, type CommandResult } from './commands.ts';
import { seedWorkspace } from './seed.ts';
import type { WorkspaceState } from './types.ts';
import { fnv1a, stableStringify } from './util.ts';

export const SCHEMA_VERSION = 1;
export const MAX_RECEIPTS = 300;

export interface Receipt { key: string; epoch: number; hash: string; revision: number; result: CommandResult }
export interface Envelope { schema: number; revision: number; epoch: number; state: WorkspaceState; receipts: Receipt[] }

export function freshEnvelope(now: number): Envelope {
  return { schema: SCHEMA_VERSION, revision: 1, epoch: 1, state: seedWorkspace(now), receipts: [] };
}

export interface ExecuteRequest { command: unknown; idempotencyKey: unknown; expectedRevision: unknown }
export type ExecuteResponse =
  | { ok: true; status: 200; revision: number; epoch: number; replayed: boolean; result: CommandResult }
  | { ok: false; status: number; code: string; message: string; revision: number; epoch: number };

export function parseRequest(raw: unknown): ExecuteRequest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new CommandError(400, 'bad_request', 'Body must be a JSON object.');
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!['command', 'idempotencyKey', 'expectedRevision'].includes(k)) throw new CommandError(400, 'unknown_field', `Unknown field "${k}".`);
  return { command: o.command, idempotencyKey: o.idempotencyKey, expectedRevision: o.expectedRevision };
}

/** Single write path: validation, idempotency (per epoch), optimistic concurrency, then the command. */
export function execute(env: Envelope, req: ExecuteRequest, now: number): { envelope: Envelope; response: ExecuteResponse } {
  const fail = (e: CommandError) => ({ envelope: env, response: { ok: false as const, status: e.status, code: e.code, message: e.message, revision: env.revision, epoch: env.epoch } });
  try {
    if (typeof req.idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(req.idempotencyKey)) throw new CommandError(400, 'bad_key', 'idempotencyKey must be 8-64 letters, digits, _ or -.');
    if (typeof req.expectedRevision !== 'number' || !Number.isInteger(req.expectedRevision)) throw new CommandError(400, 'bad_revision', 'expectedRevision must be an integer.');
    const cmd = parseCommand(req.command);
    const hash = fnv1a(stableStringify(cmd));
    const prior = env.receipts.find((r) => r.key === req.idempotencyKey && r.epoch === env.epoch);
    if (prior) {
      if (prior.hash !== hash) throw new CommandError(409, 'key_reused', 'This idempotency key was already used for a different command.');
      return { envelope: env, response: { ok: true, status: 200, revision: env.revision, epoch: env.epoch, replayed: true, result: prior.result } };
    }
    if (req.expectedRevision !== env.revision) throw new CommandError(409, 'stale_revision', `Workspace changed (now revision ${env.revision}). Refresh and try again.`);
    let state: WorkspaceState;
    let result: CommandResult;
    let epoch = env.epoch;
    if (cmd.type === 'reset') {
      state = seedWorkspace(now);
      epoch += 1;
      result = { message: 'Workspace reset to fresh sample data.' };
    } else {
      ({ state, result } = applyCommand(env.state, cmd, now));
    }
    const revision = env.revision + 1;
    const receipts = (cmd.type === 'reset' ? [] : env.receipts).concat({ key: req.idempotencyKey, epoch, hash, revision, result }).slice(-MAX_RECEIPTS);
    return { envelope: { schema: SCHEMA_VERSION, revision, epoch, state, receipts }, response: { ok: true, status: 200, revision, epoch, replayed: false, result } };
  } catch (e) {
    if (e instanceof CommandError) return fail(e);
    throw e;
  }
}

export function isEnvelope(v: unknown): v is Envelope {
  const e = v as Envelope;
  return !!e && e.schema === SCHEMA_VERSION && Number.isInteger(e.revision) && Number.isInteger(e.epoch) && !!e.state && Array.isArray(e.state.feedback) && Array.isArray(e.receipts);
}
