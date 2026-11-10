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
import { CrmService } from './crm.service.js';
import {
  AdjustPointsDto,
  CreateCustomerDto,
  ListCustomersQueryDto,
  ListPointsQueryDto,
  UpdateCustomerDto,
  UpdateLoyaltyConfigDto,
} from './dto/crm.dto.js';

@ApiTags('crm')
@ApiBearerAuth()
@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get('customers')
  @ApiOperation({ summary: 'Comensales con filtro por segmento y búsqueda' })
  listCustomers(@Query() query: ListCustomersQueryDto) {
    return this.crmService.listCustomers(query);
  }

  @Get('customers/:id')
  @ApiOperation({ summary: 'Ficha del cliente con sus últimos movimientos de puntos' })
  getCustomer(@Param('id', ParseUUIDPipe) id: string) {
    return this.crmService.getCustomer(id);
  }

  @Get('customers/:id/points')
  @ApiOperation({ summary: 'Movimientos de puntos del cliente' })
  listPoints(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListPointsQueryDto,
  ) {
    return this.crmService.listPoints(id, query);
  }

  @Post('customers')
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL', 'CAJERO', 'MESERO')
  @ApiOperation({ summary: 'Registra un comensal (teléfono único por empresa)' })
  createCustomer(@Body() dto: CreateCustomerDto) {
    return this.crmService.createCustomer(dto);
  }

  @Patch('customers/:id')
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL', 'CAJERO')
  @ApiOperation({ summary: 'Actualiza los datos del comensal' })
  updateCustomer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.crmService.updateCustomer(id, dto);
  }

  @Post('customers/:id/points')
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL')
  @ApiOperation({ summary: 'Ajuste manual de puntos (cortesía, canje o caducidad)' })
  adjustPoints(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustPointsDto,
  ) {
    return this.crmService.adjustPoints(id, dto);
  }

  @Post('customers/:id/recalculate')
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL')
  @ApiOperation({ summary: 'Recalcula visitas, puntos y segmento desde las fuentes' })
  recalculate(@Param('id', ParseUUIDPipe) id: string) {
    return this.crmService.recalcularCliente(id);
  }

  @Post('process')
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL')
  @ApiOperation({
    summary: 'Reprocesa consumos pendientes de puntos (el worker corre cada 5 min)',
  })
  processConsumptions() {
    return this.crmService.procesarConsumos();
  }

  @Get('config')
  @ApiOperation({ summary: 'Configuración de lealtad vigente' })
  config() {
    return this.crmService.config();
  }

  @Patch('config')
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL')
  @ApiOperation({ summary: 'Ajusta puntos por sol y umbrales de segmento' })
  updateConfig(@Body() dto: UpdateLoyaltyConfigDto) {
    return this.crmService.updateConfig(dto);
  }
}
