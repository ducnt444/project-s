import type { ScreenerFilter } from '../ai/ai.service.js';

export interface Quote {
  symbol: string;
  price: number;
  /** Percent change versus previous close, e.g. -2.5 */
  changePercent: number;
  timestamp: Date;
}

export interface ScreenedStock {
  symbol: string;
  name: string;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  price: number | null;
  marketCap: number | null;
  beta: number | null;
  volume: number | null;
  dividendYield: number | null;
}

export interface MarketDataProvider {
  screen(filter: ScreenerFilter): Promise<ScreenedStock[]>;
  quotes(symbols: string[]): Promise<Quote[]>;
}

export const MARKET_DATA_PROVIDER = Symbol('MARKET_DATA_PROVIDER');

/** Applies the filter fields locally; used by the mock provider and for fields an API lacks. */
export function matchesFilter(
  stock: ScreenedStock,
  f: ScreenerFilter,
): boolean {
  const eq = (a: string | null, b: string | null) =>
    !b || (a ?? '').toLowerCase() === b.toLowerCase();
  const gte = (v: number | null, min: number | null) =>
    min == null || (v != null && v >= min);
  const lte = (v: number | null, max: number | null) =>
    max == null || (v != null && v <= max);
  return (
    eq(stock.sector, f.sector) &&
    eq(stock.industry, f.industry) &&
    eq(stock.exchange, f.exchange) &&
    eq(stock.country, f.country) &&
    gte(stock.marketCap, f.marketCapMin) &&
    lte(stock.marketCap, f.marketCapMax) &&
    gte(stock.price, f.priceMin) &&
    lte(stock.price, f.priceMax) &&
    gte(stock.volume, f.volumeMin) &&
    gte(stock.beta, f.betaMin) &&
    lte(stock.beta, f.betaMax) &&
    gte(stock.dividendYield, f.dividendYieldMin)
  );
}
