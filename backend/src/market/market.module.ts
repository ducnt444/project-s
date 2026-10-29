import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FmpProvider } from './fmp.provider.js';
import {
  MARKET_DATA_PROVIDER,
  MarketDataProvider,
} from './market-data.provider.js';
import { MockProvider } from './mock.provider.js';

@Global()
@Module({
  providers: [
    {
      provide: MARKET_DATA_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MarketDataProvider => {
        const key = config.get<string>('FMP_API_KEY');
        if (key) return new FmpProvider(key);
        new Logger('MarketModule').warn(
          'FMP_API_KEY not set; using mock market data',
        );
        return new MockProvider();
      },
    },
  ],
  exports: [MARKET_DATA_PROVIDER],
})
export class MarketModule {}
