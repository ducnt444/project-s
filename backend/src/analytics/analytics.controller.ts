import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { User } from '../users/user.entity.js';
import { AnalyticsService } from './analytics.service.js';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  summary(@CurrentUser() user: User) {
    return this.analytics.summary(user.id);
  }
}
