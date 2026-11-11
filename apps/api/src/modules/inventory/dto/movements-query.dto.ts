import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';
import { tipo_movimiento_inventario } from '../../../generated/prisma/enums.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export class MovementsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sucursalId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  insumoId?: string;

  @ApiPropertyOptional({ enum: tipo_movimiento_inventario })
  @IsOptional()
  @IsIn(Object.values(tipo_movimiento_inventario))
  tipo?: tipo_movimiento_inventario;

  @ApiPropertyOptional({ example: '2026-11-01', description: 'Día de Lima, inclusive' })
  @IsOptional()
  @IsString()
  @Matches(FECHA, { message: 'desde debe ser YYYY-MM-DD' })
  desde?: string;

  @ApiPropertyOptional({ example: '2026-11-10', description: 'Día de Lima, inclusive' })
  @IsOptional()
  @IsString()
  @Matches(FECHA, { message: 'hasta debe ser YYYY-MM-DD' })
  hasta?: string;

  @ApiPropertyOptional({ default: 100, minimum: 1, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
