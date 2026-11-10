import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { BiService } from './bi.service.js';
import { RangoBiQueryDto, TopDishesQueryDto } from './dto/bi.dto.js';

@ApiTags('bi')
@ApiBearerAuth()
@Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL')
@Controller('bi')
export class BiController {
  constructor(private readonly biService: BiService) {}

  @Get('pnl')
  @ApiOperation({ summary: 'P&L del rango: ventas, gastos, margen y propinas' })
  pnl(@Query() query: RangoBiQueryDto) {
    return this.biService.pnl(query);
  }

  @Get('pnl/daily')
  @ApiOperation({ summary: 'Serie diaria del P&L para el gráfico' })
  pnlPorDia(@Query() query: RangoBiQueryDto) {
    return this.biService.pnlPorDia(query);
  }

  @Get('top-dishes')
  @ApiOperation({ summary: 'Platos más vendidos del rango' })
  topDishes(@Query() query: TopDishesQueryDto) {
    return this.biService.topDishes(query);
  }

  @Get('sales-by-method')
  @ApiOperation({ summary: 'Cobros del rango por método de pago' })
  salesByMethod(@Query() query: RangoBiQueryDto) {
    return this.biService.salesByMethod(query);
  }
}
