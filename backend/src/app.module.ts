import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from './ai/ai.module.js';
import { AlertsModule } from './alerts/alerts.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthController } from './common/health.controller.js';
import { MailModule } from './mail/mail.module.js';
import { MarketModule } from './market/market.module.js';
import { ScreenerModule } from './screener/screener.module.js';
import { TradesModule } from './trades/trades.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        // Convenient for local development; switch to migrations before deploying.
        synchronize: config.get('DB_SYNCHRONIZE', 'true') === 'true',
      }),
    }),
    ScheduleModule.forRoot(),
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
})
export class AppModule {}
