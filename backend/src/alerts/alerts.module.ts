import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alert } from './alert.entity.js';
import { AlertsController } from './alerts.controller.js';
import { AlertsMonitor } from './alerts.monitor.js';
import { AlertsService } from './alerts.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Alert])],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsMonitor],
})
export class AlertsModule {}
