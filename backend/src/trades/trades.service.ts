import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { Trade, TradeSource } from './trade.entity.js';
import { TradeInput, tradeImportSchema } from './trade-input.schema.js';

@Injectable()
export class TradesService {
  constructor(
    @InjectRepository(Trade) private readonly trades: Repository<Trade>,
  ) {}

  list(userId: string, symbol?: string) {
    return this.trades.find({
      where: { userId, ...(symbol ? { symbol: symbol.toUpperCase() } : {}) },
      order: { executedAt: 'DESC' },
    });
  }

  /** Validates an untrusted payload (array or `{ trades: [] }`) and stores it. */
  importPayload(userId: string, payload: unknown, source: TradeSource) {
    const parsed = tradeImportSchema.safeParse(payload);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid trade data',
        issues: z.treeifyError(parsed.error),
      });
    }
    return this.createMany(userId, parsed.data, source);
  }

  async createMany(userId: string, rows: TradeInput[], source: TradeSource) {
    if (rows.length === 0) return { imported: 0 };
    const entities = rows.map((r) =>
      this.trades.create({ ...r, note: r.note ?? null, userId, source }),
    );
    await this.trades.save(entities, { chunk: 500 });
    return { imported: entities.length };
  }

  async remove(userId: string, id: string) {
    const result = await this.trades.delete({ id, userId });
    if (!result.affected) throw new NotFoundException();
  }
}
