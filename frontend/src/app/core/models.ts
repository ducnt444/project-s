export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: UserProfile;
}

export type TradeSide = 'BUY' | 'SELL';

export interface TradeInput {
  symbol: string;
  side: TradeSide;
  quantity: number;
  price: number;
  fee?: number | null;
  currency?: string | null;
  executedAt: string;
  note?: string | null;
}

export interface Trade extends Omit<TradeInput, 'fee' | 'currency'> {
  id: string;
  fee: number;
  currency: string;
  source: 'manual' | 'json' | 'image';
  createdAt: string;
}

export interface ExtractedTrades {
  trades: TradeInput[];
  warnings: string[];
}

export interface PnlRow {
  key: string;
  pnl: number;
  proceeds: number;
  costBasis: number;
  trades: number;
}

export interface AnalyticsSummary {
  totals: { realizedPnl: number; closedTrades: number; winRate: number | null; tradeCount: number };
  bySymbol: PnlRow[];
  byMonth: PnlRow[];
  openPositions: { symbol: string; quantity: number; averageCost: number; costBasis: number }[];
  unmatched: { symbol: string; executedAt: string; quantity: number }[];
}

export interface ScreenedStock {
  symbol: string;
  name: string;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  price: number | null;
  marketCap: number | null;
  beta: number | null;
  volume: number | null;
  dividendYield: number | null;
}

export interface ScreenerResponse {
  filter: Record<string, string | number | null> & { explanation: string };
  results: ScreenedStock[];
}

export const ALERT_CONDITIONS = {
  PRICE_ABOVE: 'Price ≥',
  PRICE_BELOW: 'Price ≤',
  CHANGE_PCT_ABOVE: 'Daily change % ≥',
  CHANGE_PCT_BELOW: 'Daily change % ≤',
} as const;
export type AlertCondition = keyof typeof ALERT_CONDITIONS;

export interface Alert {
  id: string;
  symbol: string;
  condition: AlertCondition;
  threshold: number;
  active: boolean;
  cooldownMinutes: number;
  oneShot: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
}
