import type { ScreenerFilter } from '../ai/ai.service.js';
import {
  MarketDataProvider,
  matchesFilter,
  Quote,
  ScreenedStock,
} from './market-data.provider.js';

const UNIVERSE: ScreenedStock[] = [
  [
    'AAPL',
    'Apple Inc.',
    'NASDAQ',
    'Technology',
    'Consumer Electronics',
    230,
    3.5e12,
    1.2,
    5.5e7,
    0.45,
  ],
  [
    'MSFT',
    'Microsoft Corporation',
    'NASDAQ',
    'Technology',
    'Software',
    450,
    3.3e12,
    0.9,
    2.2e7,
    0.7,
  ],
  [
    'NVDA',
    'NVIDIA Corporation',
    'NASDAQ',
    'Technology',
    'Semiconductors',
    140,
    3.4e12,
    1.7,
    2.5e8,
    0.03,
  ],
  [
    'JNJ',
    'Johnson & Johnson',
    'NYSE',
    'Healthcare',
    'Drug Manufacturers',
    160,
    3.9e11,
    0.5,
    7e6,
    3.1,
  ],
  [
    'PFE',
    'Pfizer Inc.',
    'NYSE',
    'Healthcare',
    'Drug Manufacturers',
    28,
    1.6e11,
    0.6,
    3.5e7,
    6.0,
  ],
  [
    'KO',
    'The Coca-Cola Company',
    'NYSE',
    'Consumer Defensive',
    'Beverages',
    70,
    3e11,
    0.6,
    1.3e7,
    2.8,
  ],
  [
    'XOM',
    'Exxon Mobil Corporation',
    'NYSE',
    'Energy',
    'Oil & Gas Integrated',
    115,
    5e11,
    0.9,
    1.5e7,
    3.3,
  ],
  [
    'JPM',
    'JPMorgan Chase & Co.',
    'NYSE',
    'Financial Services',
    'Banks',
    240,
    6.8e11,
    1.1,
    9e6,
    2.1,
  ],
  [
    'PLTR',
    'Palantir Technologies',
    'NASDAQ',
    'Technology',
    'Software',
    45,
    1e11,
    2.6,
    6e7,
    null,
  ],
  [
    'SOFI',
    'SoFi Technologies',
    'NASDAQ',
    'Financial Services',
    'Credit Services',
    12,
    1.3e10,
    1.8,
    4.5e7,
    null,
  ],
].map(
  ([
    symbol,
    name,
    exchange,
    sector,
    industry,
    price,
    marketCap,
    beta,
    volume,
    dividendYield,
  ]) => ({
    symbol,
    name,
    exchange,
    sector,
    industry,
    country: 'US',
    price,
    marketCap,
    beta,
    volume,
    dividendYield,
  }),
) as ScreenedStock[];

/**
 * Offline provider for local development: a fixed universe whose prices follow a
 * random walk, so alerts can be exercised without a market data API key.
 */
export class MockProvider implements MarketDataProvider {
  private readonly prices = new Map(
    UNIVERSE.map((s) => [s.symbol, s.price ?? 100]),
  );

  async screen(filter: ScreenerFilter): Promise<ScreenedStock[]> {
    return UNIVERSE.map((s) => ({
      ...s,
      price: this.prices.get(s.symbol) ?? s.price,
    }))
      .filter((s) => matchesFilter(s, filter))
      .slice(0, filter.limit);
  }

  async quotes(symbols: string[]): Promise<Quote[]> {
    return symbols.map((symbol) => {
      const base = UNIVERSE.find((s) => s.symbol === symbol)?.price ?? 100;
      const prev = this.prices.get(symbol) ?? base;
      const price = Math.max(0.01, prev * (1 + (Math.random() - 0.5) * 0.02));
      this.prices.set(symbol, price);
      return {
        symbol,
        price,
        changePercent: ((price - base) / base) * 100,
        timestamp: new Date(),
      };
    });
  }
}
