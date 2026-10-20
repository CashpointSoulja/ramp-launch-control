import { CHANNELS, SEGMENTS, type Channel, type FeedbackItem, type Segment } from './types.ts';
import { DAY, cleanText, parseIsoTimestamp } from './util.ts';

export const CSV_HEADER = 'id,received_at,channel,account_id,account_name,segment,arr_usd,text';
export const MAX_IMPORT_ROWS = 200;

export function parseCsv(input: string): { rows: string[][] } | { error: string } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;
  const text = input.replace(/^\uFEFF/, '');
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++;
        if (i < text.length && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') return { error: `Unexpected character after closing quote on line ${rows.length + 1}.` };
        continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') {
      if (field.length > 0) return { error: `Quote in the middle of an unquoted field on line ${rows.length + 1}.` };
      quoted = true; i++; continue;
    }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r' || c === '\n') {
      row.push(field); field = '';
      if (!(row.length === 1 && row[0] === '')) rows.push(row);
      row = [];
      i += c === '\r' && text[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    field += c; i++;
  }
  if (quoted) return { error: 'Unclosed quote: the file ends inside a quoted field.' };
  row.push(field);
  if (!(row.length === 1 && row[0] === '')) rows.push(row);
  return { rows };
}

export interface ImportCheck { items: FeedbackItem[]; errors: string[] }

/** All-or-nothing validation: one bad row blocks the whole file, nothing is silently dropped. */
export function validateImport(csv: string, existingIds: ReadonlySet<string>, now: number): ImportCheck {
  const parsed = parseCsv(csv);
  if ('error' in parsed) return { items: [], errors: [parsed.error] };
  const [header, ...body] = parsed.rows;
  if (!header || header.map((h) => h.trim()).join(',') !== CSV_HEADER) return { items: [], errors: [`Header must be exactly: ${CSV_HEADER}`] };
  if (body.length === 0) return { items: [], errors: ['No data rows after the header.'] };
  if (body.length > MAX_IMPORT_ROWS) return { items: [], errors: [`${body.length} rows is over the ${MAX_IMPORT_ROWS}-row limit per import.`] };
  const errors: string[] = [];
  const items: FeedbackItem[] = [];
  const seen = new Set<string>();
  body.forEach((r, idx) => {
    const line = idx + 2;
    if (r.length !== 8) { errors.push(`Line ${line}: expected 8 columns, found ${r.length}.`); return; }
    const [id, receivedAt, channel, accountId, accountName, segment, arr, text] = r.map((v) => v.trim());
    const errs: string[] = [];
    if (!/^FB-\d{4,6}$/.test(id)) errs.push('id must look like FB-1234');
    else if (existingIds.has(id)) errs.push(`id ${id} already exists`);
    else if (seen.has(id)) errs.push(`id ${id} appears twice in this file`);
    const ts = parseIsoTimestamp(receivedAt);
    if (ts === null) errs.push('received_at must be an ISO UTC timestamp like 2026-10-19T14:05:00Z');
    else if (ts > now + 5 * 60_000) errs.push('received_at is in the future');
    else if (ts < now - 365 * DAY) errs.push('received_at is more than a year old');
    if (!CHANNELS.includes(channel as Channel)) errs.push(`channel must be one of ${CHANNELS.join(', ')}`);
    if (!/^ACC-\d{4}$/.test(accountId)) errs.push('account_id must look like ACC-1234');
    const name = cleanText(accountName, 2, 80);
    if (!name) errs.push('account_name must be 2-80 characters');
    if (!SEGMENTS.includes(segment as Segment)) errs.push(`segment must be one of ${SEGMENTS.join(', ')}`);
    if (!/^\d{1,10}$/.test(arr) || Number(arr) > 1_000_000_000) errs.push('arr_usd must be a whole number of dollars');
    const body = cleanText(text, 1, 2000);
    if (!body) errs.push('text must be 1-2000 characters');
    if (errs.length) { errors.push(`Line ${line}: ${errs.join('; ')}.`); return; }
    seen.add(id);
    items.push({ id, receivedAt: new Date(ts!).toISOString(), channel: channel as Channel, accountId, accountName: name!, segment: segment as Segment, arrUsd: Number(arr), text: body! });
  });
  return errors.length ? { items: [], errors } : { items, errors: [] };
}
