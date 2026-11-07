import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Rango de fechas obligatorio: un BI sin ventana recorre la tabla completa. */
export class RangoBiQueryDto {
  @ApiProperty({ example: '2026-11-01', description: 'Día de Lima, inclusive' })
  @IsString()
  @Matches(FECHA, { message: 'desde debe ser YYYY-MM-DD' })
  desde!: string;

  @ApiProperty({ example: '2026-11-07', description: 'Día de Lima, inclusive' })
  @IsString()
  @Matches(FECHA, { message: 'hasta debe ser YYYY-MM-DD' })
  hasta!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Solo ADMIN_GLOBAL (sin sucursal en el token). Sin valor: agregado de todas las sucursales.',
  })
  @IsOptional()
  @IsUUID()
  sucursalId?: string;
}

export class TopDishesQueryDto extends RangoBiQueryDto {
  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
