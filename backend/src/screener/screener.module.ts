import { Module } from '@nestjs/common';
import { ScreenerController } from './screener.controller.js';

@Module({
  controllers: [ScreenerController],
})
export class ScreenerModule {}
