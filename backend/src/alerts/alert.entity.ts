import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { numericTransformer } from '../trades/trade.entity.js';
import { User } from '../users/user.entity.js';

export const ALERT_CONDITIONS = [
  'PRICE_ABOVE',
  'PRICE_BELOW',
  'CHANGE_PCT_ABOVE',
  'CHANGE_PCT_BELOW',
] as const;
export type AlertCondition = (typeof ALERT_CONDITIONS)[number];

@Entity('alerts')
@Index(['active'])
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 20 })
  symbol: string;

  @Column({ type: 'varchar', length: 20 })
  condition: AlertCondition;

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 6,
    transformer: numericTransformer,
  })
  threshold: number;

  @Column({ default: true })
  active: boolean;

  /** Minimum minutes between two notifications for the same alert. */
  @Column({ name: 'cooldown_minutes', default: 60 })
  cooldownMinutes: number;

  /** Deactivate after the first notification. */
  @Column({ name: 'one_shot', default: false })
  oneShot: boolean;

  @Column({ name: 'last_triggered_at', type: 'timestamptz', nullable: true })
  lastTriggeredAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
