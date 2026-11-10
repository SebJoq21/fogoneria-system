import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import { StockAlertsService } from './stock-alerts.service.js';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, StockAlertsService],
  exports: [InventoryService, StockAlertsService],
})
export class InventoryModule {}
