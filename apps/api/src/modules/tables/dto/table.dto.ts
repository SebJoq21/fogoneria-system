import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { estado_mesa, forma_mesa } from '../../../generated/prisma/enums.js';

/** Estados que se pueden fijar a mano; `OCUPADA`/`RESERVADA` los deriva el sistema. */
export const MANUAL_TABLE_STATES = ['LIBRE', 'MANTENIMIENTO'] as const;
export type ManualTableState = (typeof MANUAL_TABLE_STATES)[number];

export class CreateTableDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Solo ADMIN_GLOBAL (sin sucursal en el token). Los demás roles lo heredan del JWT.',
  })
  @IsOptional()
  @IsUUID()
  sucursalId?: string;

  @ApiProperty({ example: '12' })
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  numero!: string;

  @ApiProperty({ example: 4, minimum: 1, maximum: 30 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  capacidad!: number;

  @ApiPropertyOptional({ example: 'Salón' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  zona?: string;

  @ApiPropertyOptional({ enum: forma_mesa, example: 'RECTANGULAR' })
  @IsOptional()
  @IsEnum(forma_mesa)
  forma?: forma_mesa;
}

export class UpdateTableDto {
  @ApiPropertyOptional({ example: '12' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  numero?: string;

  @ApiPropertyOptional({ example: 6, minimum: 1, maximum: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  capacidad?: number;

  @ApiPropertyOptional({ example: 'Terraza' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  zona?: string;

  @ApiPropertyOptional({ enum: forma_mesa })
  @IsOptional()
  @IsEnum(forma_mesa)
  forma?: forma_mesa;
}

export class UpdateTableStatusDto {
  @ApiProperty({
    enum: MANUAL_TABLE_STATES,
    example: 'MANTENIMIENTO',
    description:
      'Solo estados manuales. OCUPADA y RESERVADA se derivan de órdenes y reservas.',
  })
  @IsIn(MANUAL_TABLE_STATES, {
    message: 'estado debe ser LIBRE o MANTENIMIENTO',
  })
  estado!: ManualTableState;
}

export class ListTablesQueryDto {
  @ApiPropertyOptional({ enum: estado_mesa })
  @IsOptional()
  @IsEnum(estado_mesa)
  estado?: estado_mesa;

  @ApiPropertyOptional({ example: 'Salón' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  zona?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Solo ADMIN_GLOBAL: filtra una sucursal. Sin este valor ve todas las de su empresa.',
  })
  @IsOptional()
  @IsUUID()
  sucursalId?: string;
}
