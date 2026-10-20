import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { OrdersService } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { ListOrdersQueryDto } from './dto/list-orders.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Lista las órdenes del tenant y sucursal actual' })
  list(@Query() query: ListOrdersQueryDto) {
    return this.ordersService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una orden' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.findOne(id);
  }

  @Post()
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL', 'MESERO', 'CAJERO')
  @ApiOperation({ summary: 'Registra una orden con sus líneas' })
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL', 'COCINERO', 'MESERO', 'CAJERO')
  @ApiOperation({ summary: 'Avanza el estado de una orden (validando transiciones)' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, dto.estado);
  }
}
