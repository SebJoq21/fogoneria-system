import { Module } from '@nestjs/common';
import { BiController } from './bi.controller.js';
import { BiService } from './bi.service.js';

@Module({
  controllers: [BiController],
  providers: [BiService],
  exports: [BiService],
})
export class BiModule {}
