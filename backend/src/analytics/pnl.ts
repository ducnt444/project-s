export interface PnlTrade {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  fee: number;
  executedAt: Date;
}

export interface RealizedEvent {
  symbol: string;
  executedAt: Date;
  quantity: number;
  proceeds: number;
  costBasis: number;
  pnl: number;
}

export interface OpenPosition {
  symbol: string;
  quantity: number;
  averageCost: number;
  costBasis: number;
}

export interface PnlResult {
  realized: RealizedEvent[];
  openPositions: OpenPosition[];
  /** Sell quantity that had no matching buy lot (e.g. history imported partially). */
  unmatched: { symbol: string; executedAt: Date; quantity: number }[];
}

interface Lot {
  quantity: number;
  unitCost: number;
}

const EPSILON = 1e-9;

/**
 * Computes realized P/L by matching sells against earlier buys first-in-first-out.
 * Buy fees are added to the lot's cost basis; sell fees reduce proceeds.
 */
export function computePnl(trades: PnlTrade[]): PnlResult {
  const sorted = [...trades].sort(
    (a, b) => a.executedAt.getTime() - b.executedAt.getTime(),
  );
  const lots = new Map<string, Lot[]>();
  const realized: RealizedEvent[] = [];
  const unmatched: PnlResult['unmatched'] = [];

  for (const t of sorted) {
    const queue = lots.get(t.symbol) ?? [];
    lots.set(t.symbol, queue);

    if (t.side === 'BUY') {
      queue.push({
        quantity: t.quantity,
        unitCost: (t.quantity * t.price + t.fee) / t.quantity,
      });
      continue;
    }

    let remaining = t.quantity;
    let costBasis = 0;
    while (remaining > EPSILON && queue.length > 0) {
      const lot = queue[0];
      const take = Math.min(lot.quantity, remaining);
      costBasis += take * lot.unitCost;
      lot.quantity -= take;
      remaining -= take;
      if (lot.quantity <= EPSILON) queue.shift();
    }

    const matched = t.quantity - remaining;
    if (remaining > EPSILON) {
      unmatched.push({
        symbol: t.symbol,
        executedAt: t.executedAt,
        quantity: remaining,
      });
    }
    if (matched > EPSILON) {
      // Allocate the sell fee proportionally to the matched part.
      const proceeds = matched * t.price - t.fee * (matched / t.quantity);
      realized.push({
        symbol: t.symbol,
        executedAt: t.executedAt,
        quantity: matched,
        proceeds,
        costBasis,
        pnl: proceeds - costBasis,
      });
    }
  }

  const openPositions: OpenPosition[] = [];
  for (const [symbol, queue] of lots) {
    const quantity = queue.reduce((s, l) => s + l.quantity, 0);
    if (quantity <= EPSILON) continue;
    const costBasis = queue.reduce((s, l) => s + l.quantity * l.unitCost, 0);
    openPositions.push({
      symbol,
      quantity,
      costBasis,
      averageCost: costBasis / quantity,
    });
  }

  return { realized, openPositions, unmatched };
}

export function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** Sums realized P/L per key, returning rows sorted by key. */
export function groupPnl(
  events: RealizedEvent[],
  keyOf: (e: RealizedEvent) => string,
) {
  const totals = new Map<
    string,
    {
      key: string;
      pnl: number;
      proceeds: number;
      costBasis: number;
      trades: number;
    }
  >();
  for (const e of events) {
    const key = keyOf(e);
    const row = totals.get(key) ?? {
      key,
      pnl: 0,
      proceeds: 0,
      costBasis: 0,
      trades: 0,
    };
    row.pnl += e.pnl;
    row.proceeds += e.proceeds;
    row.costBasis += e.costBasis;
    row.trades += 1;
    totals.set(key, row);
  }
  return [...totals.values()].sort((a, b) => a.key.localeCompare(b.key));
}
