import { demoExtractedTrades, demoScreenerFilter } from './demo-ai.js';

describe('demoScreenerFilter', () => {
  it('recognises sector, size and price wording', () => {
    const f = demoScreenerFilter('Large-cap tech stocks under $300');
    expect(f).toMatchObject({
      sector: 'Technology',
      marketCapMin: 10e9,
      priceMax: 300,
      dividendYieldMin: null,
    });
    expect(f.explanation).toMatch(/^Demo mode/);
  });

  it('recognises dividend yield and beta wording', () => {
    const f = demoScreenerFilter(
      'Dividend stocks yielding more than 3% with low beta',
    );
    expect(f).toMatchObject({
      dividendYieldMin: 3,
      betaMax: 1,
      priceMin: null,
    });
  });

  it('returns no filters for unrelated text', () => {
    const f = demoScreenerFilter('anything good?');
    expect(f.explanation).toContain('no filters recognised');
  });
});

describe('demoExtractedTrades', () => {
  it('labels its rows as demo data', () => {
    const result = demoExtractedTrades();
    expect(result.trades.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/Demo mode/);
  });
});
