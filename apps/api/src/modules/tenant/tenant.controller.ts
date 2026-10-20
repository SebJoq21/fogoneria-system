import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import { TenantService } from './tenant.service.js';

@ApiTags('tenant')
@ApiBearerAuth()
@Controller('tenant')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('context')
  @ApiOperation({ summary: 'Contexto de tenant resuelto desde el JWT' })
  context(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantService.context(user);
  }

  @Get()
  @ApiOperation({ summary: 'Empresa actual con conteo de sucursales y usuarios' })
  current(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantService.currentTenant(user);
  }

  @Get('branches')
  @ApiOperation({ summary: 'Sucursales visibles para el tenant actual' })
  branches() {
    return this.tenantService.listBranches();
  }
}
