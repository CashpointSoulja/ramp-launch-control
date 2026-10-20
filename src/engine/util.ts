export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

export function fnv1a(text: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const obj = value as Record<string, unknown>;
  return '{' + Object.keys(obj).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

const ISO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseIsoTimestamp(v: unknown): number | null {
  if (typeof v !== 'string' || !ISO_TS.test(v)) return null;
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return null;
  if (new Date(t).toISOString().slice(0, 16) !== v.slice(0, 16)) return null;
  return t;
}

export function parseIsoDate(v: unknown): number | null {
  if (typeof v !== 'string' || !ISO_DATE.test(v)) return null;
  const t = Date.parse(v + 'T00:00:00Z');
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== v) return null;
  return t;
}

export const iso = (ms: number): string => new Date(ms).toISOString();
export const isoDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function cleanText(v: unknown, min: number, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  if (t.length < min || t.length > max) return null;
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(t)) return null;
  return t;
}
