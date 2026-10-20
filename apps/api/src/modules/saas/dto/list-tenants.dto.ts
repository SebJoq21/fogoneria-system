import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import {
  estado_empresa,
  plan_suscripcion,
} from '../../../generated/prisma/enums.js';

export class ListTenantsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: estado_empresa })
  @IsOptional()
  @IsEnum(estado_empresa)
  estado?: estado_empresa;

  @ApiPropertyOptional({ enum: plan_suscripcion })
  @IsOptional()
  @IsEnum(plan_suscripcion)
  plan?: plan_suscripcion;

  @ApiPropertyOptional({ description: 'Busca por nombre, RUC o email del admin' })
  @IsOptional()
  @IsString()
  search?: string;
}
