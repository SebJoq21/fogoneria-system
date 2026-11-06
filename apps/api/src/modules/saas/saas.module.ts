import { Module } from '@nestjs/common';
import { SaasController } from './saas.controller.js';
import { SaasService } from './saas.service.js';

@Module({
  controllers: [SaasController],
  providers: [SaasService],
  exports: [SaasService],
})
export class SaasModule {}
