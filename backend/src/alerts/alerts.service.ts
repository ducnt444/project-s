import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from './alert.entity.js';
import { CreateAlertDto, UpdateAlertDto } from './alerts.dto.js';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert) private readonly alerts: Repository<Alert>,
  ) {}

  list(userId: string) {
    return this.alerts.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  create(userId: string, dto: CreateAlertDto) {
    return this.alerts.save(
      this.alerts.create({ ...dto, symbol: dto.symbol.toUpperCase(), userId }),
    );
  }

  async update(userId: string, id: string, dto: UpdateAlertDto) {
    const alert = await this.alerts.findOne({ where: { id, userId } });
    if (!alert) throw new NotFoundException();
    // Re-arm when the rule changes or the alert is switched back on.
    return this.alerts.save({ ...alert, ...dto, lastTriggeredAt: null });
  }

  async remove(userId: string, id: string) {
    const result = await this.alerts.delete({ id, userId });
    if (!result.affected) throw new NotFoundException();
  }

  findActive() {
    return this.alerts.find({
      where: { active: true },
      relations: { user: true },
    });
  }

  markTriggered(alert: Alert, at: Date) {
    return this.alerts.update(alert.id, {
      lastTriggeredAt: at,
      ...(alert.oneShot ? { active: false } : {}),
    });
  }
}
