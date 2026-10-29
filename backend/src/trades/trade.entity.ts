import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity.js';

/** Postgres returns NUMERIC as string; expose it as a JS number. */
export const numericTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value == null ? value : Number(value)),
};

export type TradeSide = 'BUY' | 'SELL';
export type TradeSource = 'manual' | 'json' | 'image';

@Entity('trades')
@Index(['userId', 'executedAt'])
export class Trade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 20 })
  symbol: string;

  @Column({ type: 'varchar', length: 4 })
  side: TradeSide;

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 6,
    transformer: numericTransformer,
  })
  quantity: number;

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 6,
    transformer: numericTransformer,
  })
  price: number;

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 6,
    default: 0,
    transformer: numericTransformer,
  })
  fee: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ name: 'executed_at', type: 'timestamptz' })
  executedAt: Date;

  @Column({ type: 'varchar', length: 10, default: 'manual' })
  source: TradeSource;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
