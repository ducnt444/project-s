import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiService, ImageMediaType } from '../ai/ai.service.js';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { User } from '../users/user.entity.js';
import type { TradeSource } from './trade.entity.js';
import { TradesService } from './trades.service.js';

const IMAGE_TYPES: ImageMediaType[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];
const SOURCES: TradeSource[] = ['manual', 'json', 'image'];

@Controller('trades')
@UseGuards(JwtAuthGuard)
export class TradesController {
  constructor(
    private readonly trades: TradesService,
    private readonly ai: AiService,
  ) {}

  @Get()
  list(@CurrentUser() user: User, @Query('symbol') symbol?: string) {
    return this.trades.list(user.id, symbol);
  }

  /** Stores reviewed rows, e.g. manual entries or rows confirmed after an image import. */
  @Post()
  create(
    @CurrentUser() user: User,
    @Body() body: { trades?: unknown; source?: string },
  ) {
    const source = SOURCES.includes(body.source as TradeSource)
      ? (body.source as TradeSource)
      : 'manual';
    return this.trades.importPayload(user.id, body.trades, source);
  }

  /** Imports a JSON export: either an array of trades or `{ "trades": [...] }`. */
  @Post('import/json')
  importJson(@CurrentUser() user: User, @Body() body: unknown) {
    return this.trades.importPayload(user.id, body, 'json');
  }

  /** Extracts trades from a screenshot. Nothing is saved; the client reviews and POSTs /trades. */
  @Post('import/image')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  importImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file || !IMAGE_TYPES.includes(file.mimetype as ImageMediaType)) {
      throw new BadRequestException(
        `Upload a ${IMAGE_TYPES.join(', ')} file in the "file" field`,
      );
    }
    return this.ai.extractTradesFromImage(
      file.buffer,
      file.mimetype as ImageMediaType,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.trades.remove(user.id, id);
  }
}
