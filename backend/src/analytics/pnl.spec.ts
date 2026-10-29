import { computePnl, groupPnl, monthKey, PnlTrade } from './pnl.js';

const t = (
  side: 'BUY' | 'SELL',
  quantity: number,
  price: number,
  date: string,
  symbol = 'AAPL',
  fee = 0,
): PnlTrade => ({
  symbol,
  side,
  quantity,
  price,
  fee,
  executedAt: new Date(date),
});

describe('computePnl', () => {
  it('matches sells against the oldest lots first', () => {
    const result = computePnl([
      t('BUY', 10, 100, '2026-01-01'),
      t('BUY', 10, 120, '2026-01-05'),
      t('SELL', 15, 130, '2026-02-01'),
    ]);

    expect(result.realized).toHaveLength(1);
    // cost: 10*100 + 5*120 = 1600, proceeds: 15*130 = 1950
    expect(result.realized[0].pnl).toBeCloseTo(350);
    expect(result.openPositions).toEqual([
      { symbol: 'AAPL', quantity: 5, costBasis: 600, averageCost: 120 },
    ]);
  });

  it('includes fees on both sides', () => {
    const result = computePnl([
      t('BUY', 10, 100, '2026-01-01', 'MSFT', 5),
      t('SELL', 10, 110, '2026-01-02', 'MSFT', 5),
    ]);
    expect(result.realized[0].pnl).toBeCloseTo(90);
  });

  it('sorts input chronologically and reports unmatched sells', () => {
    const result = computePnl([
      t('SELL', 5, 50, '2026-03-01', 'TSLA'),
      t('BUY', 2, 40, '2026-02-01', 'TSLA'),
    ]);
    expect(result.realized[0].quantity).toBe(2);
    expect(result.realized[0].pnl).toBeCloseTo(20);
    expect(result.unmatched).toEqual([
      { symbol: 'TSLA', executedAt: new Date('2026-03-01'), quantity: 3 },
    ]);
  });
});

describe('groupPnl', () => {
  it('aggregates per month', () => {
    const { realized } = computePnl([
      t('BUY', 3, 10, '2026-01-01'),
      t('SELL', 1, 20, '2026-01-15'),
      t('SELL', 1, 5, '2026-01-20'),
      t('SELL', 1, 30, '2026-02-02'),
    ]);
    const rows = groupPnl(realized, (e) => monthKey(e.executedAt));
    expect(rows.map((r) => [r.key, r.pnl, r.trades])).toEqual([
      ['2026-01', 5, 2],
      ['2026-02', 20, 1],
    ]);
  });
});
