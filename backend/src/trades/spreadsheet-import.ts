import { readSheet } from 'read-excel-file/node';
import type { ExtractedTrades } from '../ai/ai.service.js';

type Cell = string | number | boolean | Date | null | undefined;
type Field =
  | 'symbol'
  | 'side'
  | 'quantity'
  | 'price'
  | 'fee'
  | 'tax'
  | 'currency'
  | 'executedAt'
  | 'status'
  | 'externalId'
  | 'note';

export const MAX_SPREADSHEET_ROWS = 5000;

/**
 * Recognised header names per field, normalised (lowercase, no accents or
 * punctuation). Earlier names win when several columns match the same field,
 * e.g. "Matched Quantity" is preferred over the ordered "Quantity".
 */
const HEADER_ALIASES: Record<Field, string[]> = {
  symbol: [
    'symbol',
    'ticker',
    'stockcode',
    'stock',
    'code',
    'instrument',
    'security',
    'machungkhoan',
    'mack',
    'macophieu',
    'ma',
  ],
  side: [
    'side',
    'buysell',
    'muaban',
    'action',
    'direction',
    'transactiontype',
    'loaigiaodich',
    'transaction',
    'type',
  ],
  quantity: [
    'matchedquantity',
    'filledquantity',
    'filledqty',
    'executedquantity',
    'executedqty',
    'klkhop',
    'khoiluongkhop',
    'quantity',
    'qty',
    'shares',
    'units',
    'volume',
    'khoiluong',
    'soluong',
    'kl',
  ],
  price: [
    'matchedprice',
    'fillprice',
    'filledprice',
    'executionprice',
    'executedprice',
    'avgprice',
    'averageprice',
    'tradeprice',
    'giakhop',
    'giathuchien',
    'price',
    'gia',
  ],
  fee: ['fee', 'fees', 'commission', 'commissions', 'phi', 'phigiaodich'],
  tax: ['tax', 'taxes', 'thue', 'thuetncn'],
  currency: ['currency', 'ccy', 'tiente'],
  executedAt: [
    'executedat',
    'executiontime',
    'filledat',
    'transactiondate',
    'tradedate',
    'tradetime',
    'datetime',
    'date',
    'time',
    'ngaygiaodich',
    'ngaykhop',
    'thoigian',
    'ngay',
  ],
  status: ['status', 'orderstatus', 'trangthai'],
  externalId: [
    'orderid',
    'orderno',
    'ordernumber',
    'tradeid',
    'transactionid',
    'sohieulenh',
    'solenh',
    'malenh',
  ],
  note: ['note', 'notes', 'comment', 'comments', 'memo', 'ghichu'],
};
const REQUIRED: Field[] = ['symbol', 'quantity', 'price', 'executedAt'];

/** Defaults for broker exports we recognise; anything else is read generically. */
interface Profile {
  name: string;
  details: string;
  currency: string;
  timeZone: string;
  dateOrder: 'dmy';
}
const SSI_IBOARD: Profile = {
  name: 'SSI iBoard order history',
  details:
    'Amounts in VND, times in Vietnam time, matched quantity and price used, tax added to the fee.',
  currency: 'VND',
  timeZone: 'Asia/Ho_Chi_Minh',
  dateOrder: 'dmy',
};

export class SpreadsheetError extends Error {}

export interface SpreadsheetTrades {
  /** The recognised broker format, or null for a generic sheet. */
  format: { name: string; details: string } | null;
  trades: (ExtractedTrades['trades'][number] & {
    note: string | null;
    externalId: string | null;
  })[];
  warnings: string[];
}

export interface SpreadsheetOptions {
  /** IANA zone used for dates without one, e.g. the uploader's browser zone. */
  timeZone?: string;
}

/** Reads the first sheet of an .xlsx file, or a .csv file, into rows of cells. */
export async function readSpreadsheet(
  file: Buffer,
  filename: string,
): Promise<Cell[][]> {
  const name = filename.toLowerCase();
  if (name.endsWith('.csv')) return parseCsv(file.toString('utf8'));
  if (name.endsWith('.xls')) {
    throw new SpreadsheetError(
      'Old .xls files are not supported. Open the file in Excel and save it as .xlsx or .csv.',
    );
  }
  if (!name.endsWith('.xlsx')) {
    throw new SpreadsheetError('Upload an .xlsx or .csv file.');
  }
  try {
    // Always pass the Buffer: given a string, the library would read it as a file path.
    return (await readSheet(file)) as Cell[][];
  } catch {
    throw new SpreadsheetError(
      'The file could not be read as an Excel (.xlsx) workbook.',
    );
  }
}

/** Minimal RFC 4180 CSV parser; detects `,` or `;` as the delimiter. */
export function parseCsv(text: string): Cell[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
      ? ';'
      : ',';

  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }
  return rows;
}

function normalise(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** "KL khớp\n(Matched Quantity)" -> ["klkhopmatchedquantity", "klkhop", "matchedquantity"] */
function headerKeys(cell: Cell): string[] {
  const parts = String(cell ?? '')
    .split(/[\n()]/)
    .map(normalise)
    .filter(Boolean);
  return [normalise(cell), ...parts];
}

function isBlank(cell: Cell): boolean {
  return cell == null || (typeof cell === 'string' && cell.trim() === '');
}

type Columns = Partial<Record<Field, number>>;

/** Maps header cells to fields; returns null unless every required field is present. */
function mapHeader(row: Cell[]): Columns | null {
  const best: Partial<Record<Field, { index: number; rank: number }>> = {};
  row.forEach((cell, index) => {
    const keys = headerKeys(cell);
    for (const field of Object.keys(HEADER_ALIASES) as Field[]) {
      const ranks = keys
        .map((k) => HEADER_ALIASES[field].indexOf(k))
        .filter((r) => r >= 0);
      if (!ranks.length) continue;
      const rank = Math.min(...ranks);
      if (!best[field] || rank < best[field].rank) {
        best[field] = { index, rank };
      }
      break; // a column maps to one field at most
    }
  });
  const columns: Columns = {};
  for (const [field, hit] of Object.entries(best)) {
    columns[field as Field] = hit.index;
  }
  return REQUIRED.every((f) => columns[f] !== undefined) ? columns : null;
}

function detectProfile(rows: Cell[][], header: Cell[]): Profile | null {
  const keys = new Set(header.flatMap(headerKeys));
  const title = rows.slice(0, 8).flat().map(normalise).join(' ');
  const ssiHeader = keys.has('machungkhoan') && keys.has('klkhop');
  return ssiHeader && (title.includes('lichsulenh') || keys.has('sohieulenh'))
    ? SSI_IBOARD
    : null;
}

export function parseNumber(cell: Cell): number | null {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
  if (typeof cell !== 'string') return null;
  let s = cell.replace(/[^\d.,\-()]/g, '');
  const negative = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()-]/g, '');
  if (!s) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    // Whichever separator comes last is the decimal point: 1,234.5 or 1.234,5
    s =
      lastComma > lastDot
        ? s.replace(/\./g, '').replace(',', '.')
        : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    // 1,234 or 1,234,567 are thousands; 12,5 is a decimal comma.
    s = /^\d{1,3}(,\d{3})+$/.test(s)
      ? s.replace(/,/g, '')
      : s.replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3}){2,}$/.test(s)) {
    s = s.replace(/\./g, ''); // 1.234.567 (dot as thousands separator)
  }
  const n = Number(s);
  return Number.isFinite(n) ? (negative ? -n : n) : null;
}

export function parseSide(cell: Cell): 'BUY' | 'SELL' | null {
  const v = normalise(cell);
  if (['buy', 'b', 'bought', 'long', 'mua', 'm'].includes(v)) return 'BUY';
  if (['sell', 's', 'sold', 'short', 'ban'].includes(v)) return 'SELL';
  return null;
}

/** True for statuses of orders that never filled (cancelled, rejected, expired, pending). */
function isUnfilledStatus(cell: Cell): boolean {
  const v = normalise(cell);
  return /cancel|reject|expire|pending|huy|tuchoi|hethieuluc|chokhop|chuakhop/.test(
    v,
  );
}

function isSummaryRow(row: Cell[]): boolean {
  const first = row.find((c) => !isBlank(c));
  return /^(tong|total|subtotal|grandtotal)/.test(normalise(first));
}

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

/** Offset of `timeZone` from UTC at the given instant, in ms. */
function zoneOffset(utcMs: number, timeZone: string): number {
  let fmt = offsetFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    offsetFormatters.set(timeZone, fmt);
  }
  const p = Object.fromEntries(
    fmt.formatToParts(new Date(utcMs)).map((x) => [x.type, Number(x.value)]),
  );
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(utcMs / 1000) * 1000;
}

/** Converts a wall-clock time in `timeZone` to the UTC instant. */
export function wallTimeToUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
  timeZone: string,
): Date {
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  if (timeZone === 'UTC') return new Date(asUtc);
  const first = asUtc - zoneOffset(asUtc, timeZone);
  // Re-check once in case the guess crossed a DST change.
  return new Date(asUtc - zoneOffset(first, timeZone));
}

export function isValidTimeZone(tz: string | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const SLASH_DATE =
  /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const ISO_LOCAL =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?$/;

export type DateOrder = 'dmy' | 'mdy';

/**
 * Decides day/month order for a column of slash dates: a value like 27/05
 * proves day-first, 05/27 proves month-first. Undecided columns use day-first.
 */
export function detectDateOrder(cells: Cell[]): {
  order: DateOrder;
  ambiguous: boolean;
} {
  let dayFirst = false;
  let monthFirst = false;
  let ambiguous = false;
  for (const cell of cells) {
    const m = typeof cell === 'string' ? cell.trim().match(SLASH_DATE) : null;
    if (!m) continue;
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a > 12) dayFirst = true;
    else if (b > 12) monthFirst = true;
    else if (a !== b) ambiguous = true;
  }
  if (monthFirst && !dayFirst) return { order: 'mdy', ambiguous: false };
  return { order: 'dmy', ambiguous: ambiguous && !dayFirst };
}

/** Parses a date cell; times without a zone are read as wall time in `timeZone`. */
export function parseDate(
  cell: Cell,
  order: DateOrder = 'dmy',
  timeZone = 'UTC',
): Date | null {
  if (cell instanceof Date) {
    // The reader returns spreadsheet date cells as UTC wall time.
    if (isNaN(cell.getTime())) return null;
    const t = new Date(Math.round(cell.getTime() / 1000) * 1000);
    return wallTimeToUtc(
      t.getUTCFullYear(),
      t.getUTCMonth() + 1,
      t.getUTCDate(),
      t.getUTCHours(),
      t.getUTCMinutes(),
      t.getUTCSeconds(),
      timeZone,
    );
  }
  if (typeof cell === 'number') {
    // Excel serial date (days since 1899-12-30) in a cell not formatted as a date.
    if (cell < 20000 || cell > 80000) return null;
    return parseDate(new Date((cell - 25569) * 86_400_000), order, timeZone);
  }
  if (typeof cell !== 'string' || !cell.trim()) return null;
  const s = cell.trim();

  const slash = s.match(SLASH_DATE);
  if (slash) {
    const [a, b, y, h = '0', mi = '0', sec = '0'] = slash.slice(1);
    // Fall back to the other order when this one is impossible (e.g. 25 as a month).
    let [day, month] =
      order === 'dmy' ? [Number(a), Number(b)] : [Number(b), Number(a)];
    if (month > 12 && day <= 12) [day, month] = [month, day];
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return wallTimeToUtc(Number(y), month, day, +h, +mi, +sec, timeZone);
  }

  const iso = s.match(ISO_LOCAL);
  if (iso) {
    const [y, mo, d, h = '0', mi = '0', sec = '0'] = iso.slice(1);
    return wallTimeToUtc(+y, +mo, +d, +h, +mi, +sec, timeZone);
  }

  // Strings with an explicit zone (e.g. 2026-03-04T10:00:00Z) and other formats.
  const t = Date.parse(s);
  return isNaN(t) ? null : new Date(t);
}

function text(cell: Cell): string {
  if (cell instanceof Date) return cell.toISOString();
  return String(cell ?? '').trim();
}

/**
 * Turns spreadsheet rows into trades. The header row is located by its column
 * names (within the first 20 rows, so title lines above it are fine).
 */
export function rowsToTrades(
  rows: Cell[][],
  options: SpreadsheetOptions = {},
): SpreadsheetTrades {
  const headerIndex = rows.slice(0, 20).findIndex((r) => mapHeader(r) !== null);
  if (headerIndex < 0) {
    throw new SpreadsheetError(
      'Could not find a header row. The sheet needs columns for symbol, quantity, price and date (side is recommended).',
    );
  }
  const columns = mapHeader(rows[headerIndex])!;
  const profile = detectProfile(rows, rows[headerIndex]);
  const timeZone =
    profile?.timeZone ??
    (isValidTimeZone(options.timeZone) ? options.timeZone : 'UTC');
  const get = (row: Cell[], field: Field): Cell =>
    columns[field] === undefined ? null : row[columns[field]];

  const trades: SpreadsheetTrades['trades'] = [];
  const warnings: string[] = [];
  let unfilled = 0;

  if (columns.side === undefined) {
    warnings.push(
      'No buy/sell column found: negative quantities were treated as sells and positive ones as buys.',
    );
  }

  const body = rows.slice(headerIndex + 1);
  if (body.length > MAX_SPREADSHEET_ROWS) {
    warnings.push(`Only the first ${MAX_SPREADSHEET_ROWS} rows were read.`);
  }
  const dataRows = body.slice(0, MAX_SPREADSHEET_ROWS);
  const dates = profile
    ? { order: profile.dateOrder, ambiguous: false }
    : detectDateOrder(dataRows.map((r) => get(r, 'executedAt')));

  dataRows.forEach((row, i) => {
    if (row.every(isBlank)) return;
    const symbol = text(get(row, 'symbol')).toUpperCase();
    if (!symbol && isSummaryRow(row)) return;

    const rawQuantity = parseNumber(get(row, 'quantity'));
    const status = get(row, 'status');
    if (
      (columns.status !== undefined && isUnfilledStatus(status)) ||
      (symbol && rawQuantity === 0)
    ) {
      unfilled++;
      return;
    }

    const line = headerIndex + i + 2; // 1-based spreadsheet row number
    const problems: string[] = [];
    if (!symbol) problems.push('symbol');
    if (rawQuantity === null) problems.push('quantity');

    let side: 'BUY' | 'SELL' | null;
    if (columns.side !== undefined) {
      side = parseSide(get(row, 'side'));
      if (!side) problems.push('side');
    } else {
      side = (rawQuantity ?? 0) < 0 ? 'SELL' : 'BUY';
    }

    const price = parseNumber(get(row, 'price'));
    if (price === null || price < 0) problems.push('price');

    const executedAt = parseDate(get(row, 'executedAt'), dates.order, timeZone);
    if (!executedAt) problems.push('date');

    if (problems.length) {
      warnings.push(
        `Row ${line} skipped: missing or unreadable ${problems.join(', ')}.`,
      );
      return;
    }

    // Fee and tax are both costs of the trade; "-" or blank means none.
    const fee = parseNumber(get(row, 'fee'));
    const tax = parseNumber(get(row, 'tax'));
    const currency = text(get(row, 'currency')).toUpperCase();
    trades.push({
      symbol,
      side: side!,
      quantity: Math.abs(rawQuantity!),
      price: price!,
      fee:
        fee === null && tax === null
          ? null
          : Math.abs(fee ?? 0) + Math.abs(tax ?? 0),
      currency: /^[A-Z]{3}$/.test(currency)
        ? currency
        : (profile?.currency ?? null),
      executedAt: executedAt!.toISOString(),
      note: text(get(row, 'note')).slice(0, 500) || null,
      externalId: text(get(row, 'externalId')).slice(0, 64) || null,
    });
  });

  if (unfilled) {
    warnings.push(
      `${unfilled} order(s) that were not filled (cancelled, rejected or zero matched quantity) were skipped.`,
    );
  }
  if (dates.ambiguous) {
    warnings.push(
      'Some dates such as 03/04/2026 could be read either way and were read as day/month/year. Check them before saving.',
    );
  }
  const format = profile
    ? { name: profile.name, details: profile.details }
    : null;
  return { format, trades, warnings };
}
