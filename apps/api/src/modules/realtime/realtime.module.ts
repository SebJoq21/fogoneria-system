import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OrdersGateway } from './orders.gateway.js';
import { RealtimeService } from './realtime.service.js';

/**
 * Tiempo real de comandas (AYCDS-14). Es `@Global` para que `orders`,
 * `tables` y `reservations` publiquen sin crear dependencias cruzadas.
 */
@Global()
@Module({
  imports: [AuthModule],
  providers: [OrdersGateway, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
