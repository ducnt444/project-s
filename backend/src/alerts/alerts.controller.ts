import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { User } from '../users/user.entity.js';
import { CreateAlertDto, UpdateAlertDto } from './alerts.dto.js';
import { AlertsService } from './alerts.service.js';

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.alerts.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateAlertDto) {
    return this.alerts.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAlertDto,
  ) {
    return this.alerts.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.alerts.remove(user.id, id);
  }
}
