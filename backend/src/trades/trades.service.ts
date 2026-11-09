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

  /** Inserts trades, skipping any whose broker ID was already imported. */
  async createMany(userId: string, rows: TradeInput[], source: TradeSource) {
    if (rows.length === 0) return { imported: 0, duplicates: 0 };
    const values = rows.map((r) => ({
      ...r,
      note: r.note ?? null,
      externalId: r.externalId ?? null,
      userId,
      source,
    }));
    let imported = 0;
    for (let i = 0; i < values.length; i += 500) {
      const result = await this.trades
        .createQueryBuilder()
        .insert()
        .values(values.slice(i, i + 500))
        .orIgnore()
        .returning(['id'])
        .execute();
      imported += (result.raw as unknown[]).length;
    }
    return { imported, duplicates: rows.length - imported };
  }

  /** Deletes every trade of the user, e.g. to start an import over. */
  async removeAll(userId: string) {
    const result = await this.trades.delete({ userId });
    return { deleted: result.affected ?? 0 };
  }

  async remove(userId: string, id: string) {
    const result = await this.trades.delete({ id, userId });
    if (!result.affected) throw new NotFoundException();
  }
}
