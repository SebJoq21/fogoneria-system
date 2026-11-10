import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { StockAlertsService } from './stock-alerts.service.js';
import { StockStatusQueryDto } from './dto/stock-alerts.dto.js';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly stockAlerts: StockAlertsService) {}

  @Get('stock')
  @ApiOperation({ summary: 'Semáforo de stock por insumo y sucursal' })
  status(@Query() query: StockStatusQueryDto) {
    return this.stockAlerts.status(query);
  }

  @Post('alerts/check')
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL')
  @ApiOperation({ summary: 'Recalcula y envía las alertas de stock (manual)' })
  check(@Query() query: StockStatusQueryDto) {
    return this.stockAlerts.checkAlerts(query);
  }
}
