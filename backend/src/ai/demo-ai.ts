import type { ExtractedTrades, ScreenerFilter } from './ai.service.js';

/**
 * Stand-ins for the Claude calls, used when ANTHROPIC_API_KEY is not set so the
 * whole UI can be tried locally. Results are clearly labelled as demo data.
 */

export function demoExtractedTrades(now = new Date()): ExtractedTrades {
  const daysAgo = (n: number) =>
    new Date(now.getTime() - n * 86_400_000).toISOString();
  return {
    trades: [
      {
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 5,
        price: 221.4,
        fee: 1,
        currency: 'USD',
        executedAt: daysAgo(14),
      },
      {
        symbol: 'NVDA',
        side: 'BUY',
        quantity: 10,
        price: 131.25,
        fee: 1,
        currency: 'USD',
        executedAt: daysAgo(9),
      },
      {
        symbol: 'NVDA',
        side: 'SELL',
        quantity: 4,
        price: 138.9,
        fee: null,
        currency: 'USD',
        executedAt: daysAgo(2),
      },
    ],
    warnings: [
      'Demo mode: no ANTHROPIC_API_KEY is set, so these are sample rows, not read from your image.',
      'Row 3: fee not shown (sample warning so you can see how warnings look).',
    ],
  };
}

const SECTORS: [RegExp, string][] = [
  [/\btech|software|semiconductor|chip/i, 'Technology'],
  [/health|pharma|drug|biotech/i, 'Healthcare'],
  [/bank|financ|fintech/i, 'Financial Services'],
  [/energy|oil|gas\b/i, 'Energy'],
  [/consumer staples|defensive|beverage|food/i, 'Consumer Defensive'],
];

/** Keyword matching that covers the common phrasings, enough to exercise the screener UI. */
export function demoScreenerFilter(prompt: string): ScreenerFilter {
  const p = prompt.toLowerCase();
  const num = (re: RegExp) => {
    const m = p.match(re);
    return m ? Number(m[1].replace(/,/g, '')) : null;
  };

  const filter: ScreenerFilter = {
    sector: SECTORS.find(([re]) => re.test(p))?.[1] ?? null,
    industry: null,
    exchange: /nasdaq/.test(p) ? 'NASDAQ' : /nyse/.test(p) ? 'NYSE' : null,
    country: null,
    marketCapMin: /large[- ]?cap|mega[- ]?cap/.test(p)
      ? 10e9
      : /mid[- ]?cap/.test(p)
        ? 2e9
        : /small[- ]?cap/.test(p)
          ? 300e6
          : null,
    marketCapMax: /mid[- ]?cap/.test(p)
      ? 10e9
      : /small[- ]?cap/.test(p)
        ? 2e9
        : null,
    priceMin: num(/(?:over|above|more than)\s*\$\s*([\d,.]+)/),
    priceMax: num(/(?:under|below|less than)\s*\$\s*([\d,.]+)/),
    volumeMin: null,
    betaMin: /high[- ]?beta|volatile/.test(p) ? 1.5 : null,
    betaMax: /low[- ]?beta|stable/.test(p) ? 1 : null,
    dividendYieldMin: num(/([\d.]+)\s*%/) ?? (/dividend/.test(p) ? 2 : null),
    limit: 20,
    explanation: '',
  };

  const parts = Object.entries(filter)
    .filter(([k, v]) => v !== null && k !== 'limit' && k !== 'explanation')
    .map(([k, v]) => `${k} ${v}`);
  filter.explanation =
    'Demo mode (keyword matching, no AI): ' +
    (parts.length
      ? parts.join(', ')
      : 'no filters recognised, showing all stocks') +
    '.';
  return filter;
}
