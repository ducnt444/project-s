import {
  detectDateOrder,
  parseCsv,
  parseDate,
  parseNumber,
  parseSide,
  rowsToTrades,
  SpreadsheetError,
  wallTimeToUtc,
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
    ['17400.00', 17400],
    ['$ 99.9', 99.9],
    ['(10)', -10],
    ['-3', -3],
    ['-', null],
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

describe('wallTimeToUtc', () => {
  it('converts local wall time to UTC', () => {
    expect(
      wallTimeToUtc(2026, 5, 27, 10, 22, 1, 'Asia/Ho_Chi_Minh').toISOString(),
    ).toBe('2026-05-27T03:22:01.000Z');
  });

  it('handles daylight saving time', () => {
    expect(
      wallTimeToUtc(2026, 7, 1, 9, 30, 0, 'America/New_York').toISOString(),
    ).toBe('2026-07-01T13:30:00.000Z');
    expect(
      wallTimeToUtc(2026, 1, 15, 9, 30, 0, 'America/New_York').toISOString(),
    ).toBe('2026-01-15T14:30:00.000Z');
  });
});

describe('detectDateOrder', () => {
  it('uses any unambiguous value to decide the whole column', () => {
    expect(detectDateOrder(['01/06/2026', '27/05/2026'])).toEqual({
      order: 'dmy',
      ambiguous: false,
    });
    expect(detectDateOrder(['01/06/2026', '05/27/2026'])).toEqual({
      order: 'mdy',
      ambiguous: false,
    });
    expect(detectDateOrder(['03/04/2026', '2026-01-01'])).toEqual({
      order: 'dmy',
      ambiguous: true,
    });
  });
});

describe('parseDate', () => {
  it('reads ISO strings as wall time and keeps explicit zones', () => {
    expect(parseDate('2026-03-04')?.toISOString()).toBe(
      '2026-03-04T00:00:00.000Z',
    );
    expect(
      parseDate('2026-03-04 09:15', 'dmy', 'Asia/Ho_Chi_Minh')?.toISOString(),
    ).toBe('2026-03-04T02:15:00.000Z');
    expect(
      parseDate(
        '2026-03-04T09:15:00Z',
        'dmy',
        'Asia/Ho_Chi_Minh',
      )?.toISOString(),
    ).toBe('2026-03-04T09:15:00.000Z');
  });

  it('reads date cells as wall time, rounded to the second', () => {
    expect(parseDate(new Date('2026-01-02T10:04:59.999Z'))?.toISOString()).toBe(
      '2026-01-02T10:05:00.000Z',
    );
    expect(
      parseDate(
        new Date('2026-01-02T10:05:00Z'),
        'dmy',
        'Asia/Ho_Chi_Minh',
      )?.toISOString(),
    ).toBe('2026-01-02T03:05:00.000Z');
    expect(parseDate(46024)?.toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });

  it('reads slash dates in the given order, swapping impossible ones', () => {
    expect(parseDate('03/04/2026', 'dmy')?.toISOString()).toBe(
      '2026-04-03T00:00:00.000Z',
    );
    expect(parseDate('03/04/2026', 'mdy')?.toISOString()).toBe(
      '2026-03-04T00:00:00.000Z',
    );
    expect(parseDate('04/25/2026 14:30', 'dmy')?.toISOString()).toBe(
      '2026-04-25T14:30:00.000Z',
    );
    expect(parseDate('31/31/2026')).toBeNull();
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
    expect(result.format).toBeNull();
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
        externalId: null,
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
        externalId: null,
      },
    ]);
    expect(result.warnings).toEqual([
      expect.stringContaining('day/month/year'),
    ]);
  });

  it('reads times in the uploader time zone', () => {
    const result = rowsToTrades(
      [
        ['Symbol', 'Side', 'Quantity', 'Price', 'Date'],
        ['MSFT', 'BUY', 1, 400, '2026-07-01 09:30'],
      ],
      { timeZone: 'America/New_York' },
    );
    expect(result.trades[0].executedAt).toBe('2026-07-01T13:30:00.000Z');
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

  describe('SSI iBoard order history', () => {
    // Same layout as the SSI export, with made-up client and order data.
    const header = [
      'Ngày giao dịch\n(Transaction Date)',
      'Mã chứng khoán\n(Stock code)',
      'Mua/Bán\n(Buy/Sell)',
      'KL đặt\n(Quantity)',
      'Giá đặt\n(Price)',
      'KL khớp\n(Matched Quantity)',
      'Giá khớp\n(Matched Price)',
      'Phí\n(Fee)',
      'Thuế\n(Tax)',
      'Thành tiền\n(Total)',
      'Loại lệnh\n(Order Type)',
      'Trạng thái\n(Status)',
      'Kênh\n(Channel)',
      'Số hiệu lệnh\n(Order ID)',
    ];
    const sheet = [
      [null, null, null, null, null, 'LỊCH SỬ LỆNH (ORDER HISTORY)'],
      [],
      [null, 'Tên khách hàng (Client name)', null, null, null, 'NGUYEN VAN A'],
      [null, 'Số tài khoản (Account number)', null, null, null, 'X000000'],
      [],
      [],
      header,
      [
        '01/06/2026 09:52:47',
        'CII',
        'Mua',
        800,
        '17,400',
        800,
        '17400.00',
        20880,
        '-',
        13940880,
        'LO',
        'Đã khớp',
        'iBoard Mobile',
        '26060100000001',
      ],
      [
        '26/05/2026 14:30:14',
        'SSI',
        'Bán',
        500,
        'ATC',
        500,
        '28000.00',
        21000,
        14000,
        13965000,
        'ATC',
        'Đã khớp',
        'iBoard Mobile',
        '26052600000002',
      ],
      [
        '25/05/2026 13:35:22',
        'GEX',
        'Mua',
        1100,
        '34,450',
        600,
        '34400.00',
        30960,
        '-',
        20670960,
        'LO',
        'Khớp một phần',
        'iBoard Mobile',
        '26052500000003',
      ],
      [
        '25/05/2026 13:34:06',
        'VIX',
        'Mua',
        1000,
        '18,700',
        0,
        '-',
        '-',
        '-',
        0,
        'LO',
        'Đã hủy',
        'iBoard Mobile',
        '26052500000004',
      ],
      [
        'Tổng (Total)',
        null,
        null,
        null,
        null,
        null,
        null,
        72840,
        14000,
        48576840,
        null,
        null,
        null,
        null,
      ],
    ];

    it('detects the format and reads matched trades', () => {
      const result = rowsToTrades(sheet, { timeZone: 'America/New_York' });
      expect(result.format?.name).toBe('SSI iBoard order history');
      expect(result.trades).toEqual([
        {
          symbol: 'CII',
          side: 'BUY',
          quantity: 800,
          price: 17400,
          fee: 20880,
          currency: 'VND',
          // 09:52:47 Vietnam time, regardless of the uploader's zone
          executedAt: '2026-06-01T02:52:47.000Z',
          note: null,
          externalId: '26060100000001',
        },
        {
          symbol: 'SSI',
          side: 'SELL',
          quantity: 500,
          price: 28000,
          fee: 35000, // fee + tax
          currency: 'VND',
          executedAt: '2026-05-26T07:30:14.000Z',
          note: null,
          externalId: '26052600000002',
        },
        {
          symbol: 'GEX',
          side: 'BUY',
          quantity: 600, // matched, not ordered
          price: 34400,
          fee: 30960,
          currency: 'VND',
          executedAt: '2026-05-25T06:35:22.000Z',
          note: null,
          externalId: '26052500000003',
        },
      ]);
      expect(result.warnings).toEqual([
        '1 order(s) that were not filled (cancelled, rejected or zero matched quantity) were skipped.',
      ]);
    });
  });
});
