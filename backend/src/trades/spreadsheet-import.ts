import { readSheet } from 'read-excel-file/node';
import type { ExtractedTrades } from '../ai/ai.service.js';

type Cell = string | number | boolean | Date | null | undefined;
type Field =
  | 'symbol'
  | 'side'
  | 'quantity'
  | 'price'
  | 'fee'
  | 'currency'
  | 'executedAt'
  | 'note';

export const MAX_SPREADSHEET_ROWS = 5000;

/** Recognised header names per field, normalised (lowercase, no accents or punctuation). */
const HEADER_ALIASES: Record<Field, string[]> = {
  symbol: [
    'symbol',
    'ticker',
    'stock',
    'code',
    'stockcode',
    'instrument',
    'security',
    'ma',
    'mack',
    'machungkhoan',
    'macophieu',
  ],
  side: [
    'side',
    'type',
    'action',
    'buysell',
    'direction',
    'transaction',
    'transactiontype',
    'ordertype',
    'loailenh',
    'lenh',
    'muaban',
    'loaigiaodich',
  ],
  quantity: [
    'quantity',
    'qty',
    'shares',
    'units',
    'volume',
    'filledqty',
    'executedqty',
    'khoiluong',
    'soluong',
    'kl',
    'klkhop',
    'khoiluongkhop',
  ],
  price: [
    'price',
    'executionprice',
    'fillprice',
    'avgprice',
    'averageprice',
    'tradeprice',
    'gia',
    'giakhop',
    'giathuchien',
  ],
  fee: ['fee', 'fees', 'commission', 'commissions', 'phi', 'phigiaodich'],
  currency: ['currency', 'ccy', 'tiente'],
  executedAt: [
    'date',
    'time',
    'datetime',
    'executedat',
    'executiontime',
    'tradedate',
    'tradetime',
    'filledat',
    'ngay',
    'thoigian',
    'ngaygiaodich',
    'ngaykhop',
  ],
  note: ['note', 'notes', 'comment', 'comments', 'memo', 'ghichu'],
};
const REQUIRED: Field[] = ['symbol', 'quantity', 'price', 'executedAt'];

export class SpreadsheetError extends Error {}

export interface SpreadsheetTrades {
  trades: (ExtractedTrades['trades'][number] & { note: string | null })[];
  warnings: string[];
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

function isBlank(cell: Cell): boolean {
  return cell == null || (typeof cell === 'string' && cell.trim() === '');
}

/** Maps header cells to fields; returns null unless every required field is present. */
function mapHeader(row: Cell[]): Partial<Record<Field, number>> | null {
  const columns: Partial<Record<Field, number>> = {};
  row.forEach((cell, index) => {
    const key = normalise(cell);
    const field = (Object.keys(HEADER_ALIASES) as Field[]).find(
      (f) => columns[f] === undefined && HEADER_ALIASES[f].includes(key),
    );
    if (field) columns[field] = index;
  });
  return REQUIRED.every((f) => columns[f] !== undefined) ? columns : null;
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

/** Excel stores times as day fractions, so 15:05 can come back as 15:04:59.999. */
function roundToSecond(ms: number): Date {
  return new Date(Math.round(ms / 1000) * 1000);
}

/** Returns the date, and whether a d/m vs m/d reading was ambiguous. */
export function parseDate(
  cell: Cell,
): { date: Date; ambiguous: boolean } | null {
  if (cell instanceof Date) {
    return isNaN(cell.getTime())
      ? null
      : { date: roundToSecond(cell.getTime()), ambiguous: false };
  }
  if (typeof cell === 'number') {
    // Excel serial date (days since 1899-12-30) in a cell not formatted as a date.
    if (cell < 20000 || cell > 80000) return null;
    return {
      date: roundToSecond((cell - 25569) * 86_400_000),
      ambiguous: false,
    };
  }
  if (typeof cell !== 'string' || !cell.trim()) return null;
  const s = cell.trim();

  const dmy = s.match(
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (dmy) {
    const [a, b, year, h = '0', min = '0', sec = '0'] = dmy.slice(1);
    const first = Number(a);
    const second = Number(b);
    // Day first unless that is impossible (e.g. 04/25/2026).
    const monthFirst = first <= 12 && second > 12;
    const day = monthFirst ? second : first;
    const month = monthFirst ? first : second;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return {
      date: new Date(
        Date.UTC(
          Number(year),
          month - 1,
          day,
          Number(h),
          Number(min),
          Number(sec),
        ),
      ),
      ambiguous: first <= 12 && second <= 12 && first !== second,
    };
  }

  const t = Date.parse(s);
  return isNaN(t) ? null : { date: new Date(t), ambiguous: false };
}

/**
 * Turns spreadsheet rows into trades. The header row is located by its column
 * names (within the first 20 rows, so title lines above it are fine).
 */
export function rowsToTrades(rows: Cell[][]): SpreadsheetTrades {
  const headerIndex = rows.slice(0, 20).findIndex((r) => mapHeader(r) !== null);
  if (headerIndex < 0) {
    throw new SpreadsheetError(
      'Could not find a header row. The sheet needs columns for symbol, quantity, price and date (side is recommended).',
    );
  }
  const columns = mapHeader(rows[headerIndex])!;
  const get = (row: Cell[], field: Field): Cell =>
    columns[field] === undefined ? null : row[columns[field]];

  const trades: SpreadsheetTrades['trades'] = [];
  const warnings: string[] = [];
  let ambiguousDates = 0;

  if (columns.side === undefined) {
    warnings.push(
      'No buy/sell column found: negative quantities were treated as sells and positive ones as buys.',
    );
  }

  const body = rows.slice(headerIndex + 1);
  if (body.length > MAX_SPREADSHEET_ROWS) {
    warnings.push(`Only the first ${MAX_SPREADSHEET_ROWS} rows were read.`);
  }

  body.slice(0, MAX_SPREADSHEET_ROWS).forEach((row, i) => {
    if (row.every(isBlank)) return;
    const line = headerIndex + i + 2; // 1-based spreadsheet row number
    const problems: string[] = [];

    const symbol = String(get(row, 'symbol') ?? '')
      .trim()
      .toUpperCase();
    if (!symbol) problems.push('symbol');

    const rawQuantity = parseNumber(get(row, 'quantity'));
    if (rawQuantity === null || rawQuantity === 0) problems.push('quantity');

    let side: 'BUY' | 'SELL' | null;
    if (columns.side !== undefined) {
      side = parseSide(get(row, 'side'));
      if (!side) problems.push('side');
    } else {
      side = (rawQuantity ?? 0) < 0 ? 'SELL' : 'BUY';
    }

    const price = parseNumber(get(row, 'price'));
    if (price === null || price < 0) problems.push('price');

    const parsedDate = parseDate(get(row, 'executedAt'));
    if (!parsedDate) problems.push('date');

    if (problems.length) {
      warnings.push(
        `Row ${line} skipped: missing or unreadable ${problems.join(', ')}.`,
      );
      return;
    }
    if (parsedDate!.ambiguous) ambiguousDates++;

    const fee = parseNumber(get(row, 'fee'));
    const note = String(get(row, 'note') ?? '')
      .trim()
      .slice(0, 500);
    const currency = String(get(row, 'currency') ?? '')
      .trim()
      .toUpperCase();
    trades.push({
      symbol,
      side: side!,
      quantity: Math.abs(rawQuantity!),
      price: price!,
      fee: fee === null ? null : Math.abs(fee),
      currency: /^[A-Z]{3}$/.test(currency) ? currency : null,
      executedAt: parsedDate!.date.toISOString(),
      note: note || null,
    });
  });

  if (ambiguousDates) {
    warnings.push(
      `${ambiguousDates} date(s) such as 03/04/2026 could be read either way and were read as day/month/year. Check them before saving.`,
    );
  }
  return { trades, warnings };
}
