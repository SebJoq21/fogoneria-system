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
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import { SaasService } from './saas.service.js';
import {
  ChangePlanDto,
  CreateTenantDto,
  ReactivateTenantDto,
  SuspendTenantDto,
} from './dto/create-tenant.dto.js';
import { ListTenantsQueryDto } from './dto/list-tenants.dto.js';

@ApiTags('saas')
@ApiBearerAuth()
@Roles('SUPERADMIN')
@Controller('saas')
export class SaasController {
  constructor(private readonly saas: SaasService) {}

  @Post('tenants')
  @ApiOperation({ summary: 'Da de alta una empresa (tenant) en trial' })
  create(
    @Body() dto: CreateTenantDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.saas.createTenant(dto, actor);
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Lista empresas con filtros y paginación' })
  list(@Query() query: ListTenantsQueryDto) {
    return this.saas.list(query);
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Detalle de una empresa con su historial de suscripción' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.saas.getTenant(id);
  }

  @Post('tenants/:id/suspend')
  @ApiOperation({ summary: 'Suspende una empresa por morosidad' })
  suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendTenantDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.saas.suspend(id, dto.motivo, actor);
  }

  @Post('tenants/:id/reactivate')
  @ApiOperation({ summary: 'Reactiva una empresa suspendida' })
  reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReactivateTenantDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.saas.reactivate(id, dto.motivo, actor);
  }

  @Patch('tenants/:id/plan')
  @ApiOperation({ summary: 'Cambia el plan y el MRR de una empresa' })
  changePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePlanDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.saas.changePlan(id, dto, actor);
  }

  @Get('tenants/:id/history')
  @ApiOperation({ summary: 'Auditoría reciente de la empresa' })
  history(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.saas.history(id, query);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'KPIs de la consola: empresas por estado y MRR' })
  metrics() {
    return this.saas.metrics();
  }
}
