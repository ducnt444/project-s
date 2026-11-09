import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from './ai/ai.module.js';
import { AlertsModule } from './alerts/alerts.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthController } from './common/health.controller.js';
import { MailModule } from './mail/mail.module.js';
import { MIGRATIONS } from './migrations/index.js';
import { MarketModule } from './market/market.module.js';
import { ScreenerModule } from './screener/screener.module.js';
import { TradesModule } from './trades/trades.module.js';
import { UsersModule } from './users/users.module.js';

/** DB_SSL: "true" (verify the server certificate), "no-verify", or unset for no SSL. */
function sslOption(value?: string) {
  if (value === 'true') return { rejectUnauthorized: true };
  if (value === 'no-verify') return { rejectUnauthorized: false };
  return false;
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        ssl: sslOption(config.get<string>('DB_SSL')),
        autoLoadEntities: true,
        // Local development syncs tables to the entities. Deployed builds turn
        // that off and apply migrations instead (see the Dockerfile).
        synchronize: config.get('DB_SYNCHRONIZE', 'true') === 'true',
        migrations: MIGRATIONS,
        migrationsRun: config.get('DB_MIGRATIONS_RUN', 'false') === 'true',
      }),
    }),
    ScheduleModule.forRoot(),
    // Per-IP limit for every route; auth and AI routes set stricter ones.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    UsersModule,
    AuthModule,
    AiModule,
    MarketModule,
    MailModule,
    TradesModule,
    AnalyticsModule,
    ScreenerModule,
    AlertsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
