import type { Quote } from '../market/market-data.provider.js';
import type { AlertCondition } from './alert.entity.js';

export interface AlertRule {
  condition: AlertCondition;
  threshold: number;
  cooldownMinutes: number;
  lastTriggeredAt: Date | null;
}

export function conditionMet(
  rule: Pick<AlertRule, 'condition' | 'threshold'>,
  quote: Quote,
): boolean {
  switch (rule.condition) {
    case 'PRICE_ABOVE':
      return quote.price >= rule.threshold;
    case 'PRICE_BELOW':
      return quote.price <= rule.threshold;
    case 'CHANGE_PCT_ABOVE':
      return quote.changePercent >= rule.threshold;
    case 'CHANGE_PCT_BELOW':
      return quote.changePercent <= rule.threshold;
  }
}

/** True when the alert should notify now: condition holds and it is outside its cooldown. */
export function shouldNotify(
  rule: AlertRule,
  quote: Quote,
  now = new Date(),
): boolean {
  if (!conditionMet(rule, quote)) return false;
  if (!rule.lastTriggeredAt) return true;
  return (
    now.getTime() - rule.lastTriggeredAt.getTime() >=
    rule.cooldownMinutes * 60_000
  );
}

export function describeCondition(
  condition: AlertCondition,
  threshold: number,
): string {
  switch (condition) {
    case 'PRICE_ABOVE':
      return `price at or above ${threshold}`;
    case 'PRICE_BELOW':
      return `price at or below ${threshold}`;
    case 'CHANGE_PCT_ABOVE':
      return `daily change at or above ${threshold}%`;
    case 'CHANGE_PCT_BELOW':
      return `daily change at or below ${threshold}%`;
  }
}
