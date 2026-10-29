import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { demoExtractedTrades, demoScreenerFilter } from './demo-ai.js';

const extractedTradesSchema = z.object({
  trades: z.array(
    z.object({
      symbol: z.string().describe('Ticker symbol, e.g. AAPL'),
      side: z.enum(['BUY', 'SELL']),
      quantity: z.number(),
      price: z.number().describe('Execution price per share'),
      fee: z.number().nullable().describe('Commission/fees, null if not shown'),
      currency: z
        .string()
        .nullable()
        .describe('ISO 4217 code, null if not shown'),
      executedAt: z.string().describe('ISO 8601 date-time of execution'),
    }),
  ),
  warnings: z
    .array(z.string())
    .describe(
      'Rows or fields that were unreadable or ambiguous, in plain language',
    ),
});
export type ExtractedTrades = z.infer<typeof extractedTradesSchema>;

export const screenerFilterSchema = z.object({
  sector: z.string().nullable(),
  industry: z.string().nullable(),
  exchange: z.string().nullable().describe('e.g. NASDAQ, NYSE'),
  country: z.string().nullable().describe('ISO 3166 alpha-2, e.g. US'),
  marketCapMin: z.number().nullable().describe('USD'),
  marketCapMax: z.number().nullable().describe('USD'),
  priceMin: z.number().nullable(),
  priceMax: z.number().nullable(),
  volumeMin: z.number().nullable().describe('Average daily volume'),
  betaMin: z.number().nullable(),
  betaMax: z.number().nullable(),
  dividendYieldMin: z.number().nullable().describe('Percent, e.g. 3 for 3%'),
  limit: z.number().describe('Number of results to return, 1-100'),
  explanation: z
    .string()
    .describe('One sentence restating the filter for the user'),
});
export type ScreenerFilter = z.infer<typeof screenerFilterSchema>;

export type ImageMediaType =
  'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

const MODEL = 'claude-opus-5-5';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client?: Anthropic;

  /** Without an API key the AI features fall back to labelled demo results. */
  readonly demoMode: boolean;

  constructor(private readonly config: ConfigService) {
    this.demoMode = !config.get<string>('ANTHROPIC_API_KEY');
    if (this.demoMode) {
      this.logger.warn(
        'ANTHROPIC_API_KEY not set; AI features return demo data',
      );
    }
  }

  /** Reads a brokerage screenshot and returns the trade rows it shows. */
  async extractTradesFromImage(
    image: Buffer,
    mediaType: ImageMediaType,
  ): Promise<ExtractedTrades> {
    if (this.demoMode) return demoExtractedTrades();
    const response = await this.call(() =>
      this.anthropic().beta.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: {
          effort: 'medium',
          format: betaZodOutputFormat(extractedTradesSchema),
        },
        system:
          'You extract executed stock trades from screenshots of brokerage or trading apps. ' +
          'Return only trades that are actually visible. Do not invent values: if a field is not ' +
          'shown use null (fee, currency) and add a warning. If the screenshot only shows a date, ' +
          'use 00:00 local time. Today is ' +
          new Date().toISOString().slice(0, 10) +
          '; resolve relative dates against it.',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: image.toString('base64'),
                },
              },
              {
                type: 'text',
                text: 'Extract every executed trade in this screenshot.',
              },
            ],
          },
        ],
      }),
    );
    return this.unwrap(response);
  }

  /** Turns a natural-language screening question into structured filter criteria. */
  async parseScreenerQuery(prompt: string): Promise<ScreenerFilter> {
    if (this.demoMode) return demoScreenerFilter(prompt);
    const response = await this.call(() =>
      this.anthropic().beta.messages.parse({
        model: MODEL,
        max_tokens: 4000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: {
          effort: 'low',
          format: betaZodOutputFormat(screenerFilterSchema),
        },
        system:
          'You translate stock screening questions into filter criteria for a stock screener API. ' +
          'Set a field only when the question implies it; otherwise null. Convert words like ' +
          '"large cap" to concrete numbers (large cap: >= 10e9 USD, mid cap: 2e9-10e9, small cap: ' +
          '300e6-2e9). Use standard GICS sector names (e.g. "Technology", "Healthcare"). Default ' +
          'limit is 20.',
        messages: [{ role: 'user', content: prompt }],
      }),
    );
    const filter = this.unwrap(response);
    return {
      ...filter,
      limit: Math.min(Math.max(Math.round(filter.limit) || 20, 1), 100),
    };
  }

  /** Maps SDK errors to HTTP errors the client can act on. */
  private async call<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request();
    } catch (err) {
      if (
        err instanceof Anthropic.AuthenticationError ||
        err instanceof Anthropic.PermissionDeniedError
      ) {
        this.logger.error(`Claude API credentials rejected: ${err.message}`);
        throw new ServiceUnavailableException(
          'AI features are not configured (check ANTHROPIC_API_KEY)',
        );
      }
      if (err instanceof Anthropic.RateLimitError) {
        throw new HttpException(
          'AI service is busy, try again shortly',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (err instanceof Anthropic.APIError) {
        this.logger.error(`Claude API error ${err.status}: ${err.message}`);
        throw new BadGatewayException('AI service request failed');
      }
      throw err;
    }
  }

  private unwrap<T>(response: {
    stop_reason: string | null;
    parsed_output?: T | null;
  }): T {
    if (response.stop_reason === 'refusal') {
      throw new UnprocessableEntityException(
        'The AI model declined this request',
      );
    }
    if (response.parsed_output == null) {
      this.logger.warn(
        `No parsed output (stop_reason=${response.stop_reason})`,
      );
      throw new BadGatewayException(
        'The AI model returned an unusable response',
      );
    }
    return response.parsed_output;
  }

  private anthropic(): Anthropic {
    // Created lazily so the app can boot without AI credentials configured.
    this.client ??= new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    });
    return this.client;
  }
}
