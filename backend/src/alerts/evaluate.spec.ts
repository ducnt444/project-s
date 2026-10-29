import { conditionMet, shouldNotify } from './evaluate.js';

const quote = (price: number, changePercent = 0) => ({
  symbol: 'AAPL',
  price,
  changePercent,
  timestamp: new Date(),
});

describe('conditionMet', () => {
  it('handles price thresholds inclusively', () => {
    expect(
      conditionMet({ condition: 'PRICE_ABOVE', threshold: 100 }, quote(100)),
    ).toBe(true);
    expect(
      conditionMet({ condition: 'PRICE_ABOVE', threshold: 100 }, quote(99.9)),
    ).toBe(false);
    expect(
      conditionMet({ condition: 'PRICE_BELOW', threshold: 100 }, quote(99)),
    ).toBe(true);
  });

  it('handles percent change thresholds', () => {
    expect(
      conditionMet(
        { condition: 'CHANGE_PCT_BELOW', threshold: -5 },
        quote(1, -6),
      ),
    ).toBe(true);
    expect(
      conditionMet(
        { condition: 'CHANGE_PCT_ABOVE', threshold: 5 },
        quote(1, 4),
      ),
    ).toBe(false);
  });
});

describe('shouldNotify', () => {
  const rule = {
    condition: 'PRICE_ABOVE' as const,
    threshold: 100,
    cooldownMinutes: 60,
  };
  const now = new Date('2026-10-01T12:00:00Z');

  it('notifies the first time the condition holds', () => {
    expect(
      shouldNotify({ ...rule, lastTriggeredAt: null }, quote(150), now),
    ).toBe(true);
  });

  it('respects the cooldown', () => {
    const recent = new Date('2026-10-01T11:30:00Z');
    const old = new Date('2026-10-01T10:59:00Z');
    expect(
      shouldNotify({ ...rule, lastTriggeredAt: recent }, quote(150), now),
    ).toBe(false);
    expect(
      shouldNotify({ ...rule, lastTriggeredAt: old }, quote(150), now),
    ).toBe(true);
  });
});
