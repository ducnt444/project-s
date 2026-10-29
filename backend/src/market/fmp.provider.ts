import { BadGatewayException, Logger } from '@nestjs/common';
import type { ScreenerFilter } from '../ai/ai.service.js';
import {
  MarketDataProvider,
  matchesFilter,
  Quote,
  ScreenedStock,
} from './market-data.provider.js';

const BASE_URL = 'https://financialmodelingprep.com/stable';

/** Financial Modeling Prep (https://site.financialmodelingprep.com) market data. */
export class FmpProvider implements MarketDataProvider {
  private readonly logger = new Logger(FmpProvider.name);

  constructor(private readonly apiKey: string) {}

  async screen(f: ScreenerFilter): Promise<ScreenedStock[]> {
    const rows = await this.get<any[]>('company-screener', {
      sector: f.sector,
      industry: f.industry,
      exchange: f.exchange,
      country: f.country,
      marketCapMoreThan: f.marketCapMin,
      marketCapLowerThan: f.marketCapMax,
      priceMoreThan: f.priceMin,
      priceLowerThan: f.priceMax,
      volumeMoreThan: f.volumeMin,
      betaMoreThan: f.betaMin,
      betaLowerThan: f.betaMax,
      isActivelyTrading: true,
      // Over-fetch because dividend yield is filtered locally.
      limit: f.dividendYieldMin != null ? f.limit * 5 : f.limit,
    });
    return rows
      .map((r): ScreenedStock => ({
        symbol: r.symbol,
        name: r.companyName ?? r.symbol,
        exchange: r.exchangeShortName ?? r.exchange ?? null,
        sector: r.sector ?? null,
        industry: r.industry ?? null,
        country: r.country ?? null,
        price: r.price ?? null,
        marketCap: r.marketCap ?? null,
        beta: r.beta ?? null,
        volume: r.volume ?? null,
        dividendYield:
          r.price && r.lastAnnualDividend != null
            ? (r.lastAnnualDividend / r.price) * 100
            : null,
      }))
      .filter((s) =>
        matchesFilter(s, {
          ...f,
          sector: null,
          industry: null,
          exchange: null,
          country: null,
        }),
      )
      .slice(0, f.limit);
  }

  async quotes(symbols: string[]): Promise<Quote[]> {
    if (symbols.length === 0) return [];
    const rows = await this.get<any[]>('batch-quote', {
      symbols: symbols.join(','),
    });
    return rows.map((r) => ({
      symbol: r.symbol,
      price: r.price,
      changePercent: r.changePercentage ?? 0,
      timestamp: r.timestamp ? new Date(r.timestamp * 1000) : new Date(),
    }));
  }

  private async get<T>(
    path: string,
    params: Record<string, string | number | boolean | null | undefined>,
  ) {
    const url = new URL(`${BASE_URL}/${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '') url.searchParams.set(k, String(v));
    }
    url.searchParams.set('apikey', this.apiKey);
    const res = await fetch(url);
    if (!res.ok) {
      this.logger.error(`FMP ${path} failed: ${res.status}`);
      throw new BadGatewayException('Market data provider request failed');
    }
    return (await res.json()) as T;
  }
}
