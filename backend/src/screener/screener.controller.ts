import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AiService } from '../ai/ai.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import {
  MARKET_DATA_PROVIDER,
  type MarketDataProvider,
} from '../market/market-data.provider.js';

class ScreenerQueryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  prompt: string;
}

@Controller('screener')
@UseGuards(JwtAuthGuard)
export class ScreenerController {
  constructor(
    private readonly ai: AiService,
    @Inject(MARKET_DATA_PROVIDER) private readonly market: MarketDataProvider,
  ) {}

  /** Natural-language stock screening, e.g. "large-cap tech stocks under $200 with low beta". */
  @Post('query')
  @HttpCode(200)
  async query(@Body() dto: ScreenerQueryDto) {
    const filter = await this.ai.parseScreenerQuery(dto.prompt);
    const results = await this.market.screen(filter);
    return { filter, results };
  }
}
