import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { estado_orden } from '../../../generated/prisma/enums.js';

export class ListOrdersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: estado_orden })
  @IsOptional()
  @IsEnum(estado_orden)
  estado?: estado_orden;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sucursalId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  mesaId?: string;
}
