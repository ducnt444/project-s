import {
  parseCsv,
  parseDate,
  parseNumber,
  parseSide,
  rowsToTrades,
  SpreadsheetError,
} from './spreadsheet-import.js';

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, CRLF and a BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ]);
  });

  it('detects semicolon delimiters', () => {
    expect(parseCsv('Symbol;Price\nAAPL;1,5')).toEqual([
      ['Symbol', 'Price'],
      ['AAPL', '1,5'],
    ]);
  });
});

describe('parseNumber', () => {
  it.each([
    [12.5, 12.5],
    ['1,234.50', 1234.5],
    ['1.234,50', 1234.5],
    ['1,234', 1234],
    ['12,5', 12.5],
    ['1.234.567', 1234567],
    ['$ 99.9', 99.9],
    ['(10)', -10],
    ['-3', -3],
    ['', null],
    ['abc', null],
  ])('%s -> %s', (input, expected) => {
    expect(parseNumber(input)).toBe(expected);
  });
});

describe('parseSide', () => {
  it('accepts common English and Vietnamese words', () => {
    expect(parseSide('Buy')).toBe('BUY');
    expect(parseSide('S')).toBe('SELL');
    expect(parseSide('Mua')).toBe('BUY');
    expect(parseSide('Bán')).toBe('SELL');
    expect(parseSide('hold')).toBeNull();
  });
});

describe('parseDate', () => {
  it('reads ISO strings, Date cells and Excel serials', () => {
    expect(parseDate('2026-03-04')?.date.toISOString()).toBe(
      '2026-03-04T00:00:00.000Z',
    );
    expect(parseDate(new Date('2026-01-02T10:04:59.999Z'))?.date).toEqual(
      new Date('2026-01-02T10:05:00Z'),
    );
    expect(parseDate(46024)?.date.toISOString()).toBe(
      '2026-01-02T00:00:00.000Z',
    );
  });

  it('reads slash dates day-first, switching when the day is impossible', () => {
    expect(parseDate('25/04/2026')).toEqual({
      date: new Date('2026-04-25T00:00:00Z'),
      ambiguous: false,
    });
    expect(parseDate('04/25/2026 14:30')?.date.toISOString()).toBe(
      '2026-04-25T14:30:00.000Z',
    );
    expect(parseDate('03/04/2026')).toEqual({
      date: new Date('2026-04-03T00:00:00Z'),
      ambiguous: true,
    });
  });
});

describe('rowsToTrades', () => {
  it('finds the header below title rows and maps aliased columns', () => {
    const result = rowsToTrades([
      ['My broker export'],
      [],
      ['Ticker', 'Action', 'Qty', 'Fill price', 'Commission', 'Trade date'],
      ['aapl', 'BUY', 10, 182.5, 1, new Date('2026-01-08T15:30:00Z')],
      ['AAPL', 'Sell', '4', '205.10', '', '12/03/2026'],
      [null, null, null, null, null, null],
    ]);
    expect(result.trades).toEqual([
      {
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 10,
        price: 182.5,
        fee: 1,
        currency: null,
        executedAt: '2026-01-08T15:30:00.000Z',
        note: null,
      },
      {
        symbol: 'AAPL',
        side: 'SELL',
        quantity: 4,
        price: 205.1,
        fee: null,
        currency: null,
        executedAt: '2026-03-12T00:00:00.000Z',
        note: null,
      },
    ]);
    expect(result.warnings).toEqual([
      expect.stringContaining('day/month/year'),
    ]);
  });

  it('reports unreadable rows with their spreadsheet row number', () => {
    const result = rowsToTrades([
      ['Symbol', 'Side', 'Quantity', 'Price', 'Date'],
      ['MSFT', 'hold', 2, 400, '2026-03-01'],
      ['MSFT', 'BUY', 2, 'n/a', '2026-03-01'],
    ]);
    expect(result.trades).toHaveLength(0);
    expect(result.warnings).toEqual([
      'Row 2 skipped: missing or unreadable side.',
      'Row 3 skipped: missing or unreadable price.',
    ]);
  });

  it('infers side from the quantity sign when there is no side column', () => {
    const result = rowsToTrades([
      ['Mã CK', 'Khối lượng', 'Giá', 'Ngày giao dịch'],
      ['FPT', -100, 95000, '2026-02-01'],
    ]);
    expect(result.trades[0]).toMatchObject({
      symbol: 'FPT',
      side: 'SELL',
      quantity: 100,
    });
    expect(result.warnings[0]).toMatch(/No buy\/sell column/);
  });

  it('rejects sheets without a recognisable header', () => {
    expect(() =>
      rowsToTrades([
        ['a', 'b'],
        [1, 2],
      ]),
    ).toThrow(SpreadsheetError);
  });
});
