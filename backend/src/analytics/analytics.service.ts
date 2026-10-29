import { Injectable } from '@nestjs/common';
import { TradesService } from '../trades/trades.service.js';
import { computePnl, groupPnl, monthKey } from './pnl.js';

@Injectable()
export class AnalyticsService {
  constructor(private readonly trades: TradesService) {}

  async summary(userId: string) {
    const trades = await this.trades.list(userId);
    const { realized, openPositions, unmatched } = computePnl(trades);
    const totalRealized = realized.reduce((s, e) => s + e.pnl, 0);
    const wins = realized.filter((e) => e.pnl > 0).length;

    return {
      totals: {
        realizedPnl: totalRealized,
        closedTrades: realized.length,
        winRate: realized.length ? wins / realized.length : null,
        tradeCount: trades.length,
      },
      bySymbol: groupPnl(realized, (e) => e.symbol).sort(
        (a, b) => b.pnl - a.pnl,
      ),
      byMonth: groupPnl(realized, (e) => monthKey(e.executedAt)),
      openPositions,
      unmatched,
    };
  }
}
