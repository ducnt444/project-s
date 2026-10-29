import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { MailService } from '../mail/mail.service.js';
import {
  MARKET_DATA_PROVIDER,
  type MarketDataProvider,
} from '../market/market-data.provider.js';
import { AlertsService } from './alerts.service.js';
import { describeCondition, shouldNotify } from './evaluate.js';

/**
 * Polls quotes for every symbol with an active alert and emails the owner when a
 * condition is met. The interval is ALERT_POLL_SECONDS (default 30).
 */
@Injectable()
export class AlertsMonitor implements OnApplicationBootstrap {
  private readonly logger = new Logger(AlertsMonitor.name);
  private running = false;

  constructor(
    private readonly alerts: AlertsService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
    @Inject(MARKET_DATA_PROVIDER) private readonly market: MarketDataProvider,
  ) {}

  onApplicationBootstrap() {
    const seconds = Number(this.config.get('ALERT_POLL_SECONDS', 30));
    if (seconds <= 0) {
      this.logger.warn('Alert monitor disabled (ALERT_POLL_SECONDS <= 0)');
      return;
    }
    this.scheduler.addInterval(
      'alerts-monitor',
      setInterval(() => void this.tick(), seconds * 1000),
    );
    this.logger.log(`Alert monitor polling every ${seconds}s`);
  }

  async tick() {
    // Skip if the previous run is still in progress.
    if (this.running) return;
    this.running = true;
    try {
      const active = await this.alerts.findActive();
      if (active.length === 0) return;

      const symbols = [...new Set(active.map((a) => a.symbol))];
      const quotes = new Map(
        (await this.market.quotes(symbols)).map((q) => [q.symbol, q]),
      );
      const now = new Date();

      for (const alert of active) {
        const quote = quotes.get(alert.symbol);
        if (!quote || !shouldNotify(alert, quote, now)) continue;

        const rule = describeCondition(alert.condition, alert.threshold);
        try {
          await this.mail.send(
            alert.user.email,
            `[Project S] ${alert.symbol}: ${rule}`,
            `${alert.symbol} is at ${quote.price.toFixed(2)} (${quote.changePercent.toFixed(2)}% today), ` +
              `which meets your alert: ${rule}.\n\nQuote time: ${quote.timestamp.toISOString()}`,
          );
          await this.alerts.markTriggered(alert, now);
        } catch (err) {
          this.logger.error(`Failed to notify alert ${alert.id}`, err as Error);
        }
      }
    } catch (err) {
      this.logger.error('Alert monitor run failed', err as Error);
    } finally {
      this.running = false;
    }
  }
}
