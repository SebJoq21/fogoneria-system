import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import { AuditService } from './audit.service.js';
import { ListAuditQueryDto } from './audit.dto.js';

@ApiTags('audit')
@ApiBearerAuth()
@Roles('ADMIN_GLOBAL')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Últimos eventos de auditoría de la empresa' })
  async list(@CurrentUser() user: AuthenticatedUser | undefined, @Query() query: ListAuditQueryDto) {
    if (!user?.empresaId) {
      throw new BadRequestException('El usuario no tiene una empresa asociada.');
    }
    const items = await this.audit.list(user.empresaId, query.limit ?? 50);
    return { items };
  }
}
