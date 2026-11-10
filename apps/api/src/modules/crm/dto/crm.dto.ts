import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import {
  segmento_cliente,
  tipo_movimiento_puntos,
} from '../../../generated/prisma/enums.js';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Ana Torres', maxLength: 120 })
  @IsString()
  @MaxLength(120)
  nombre!: string;

  @ApiProperty({ example: '987654321', description: 'Teléfono único por empresa' })
  @IsString()
  @Matches(/^\+?\d{6,15}$/, { message: 'El teléfono debe tener entre 6 y 15 dígitos' })
  telefono!: string;
}

export class UpdateCustomerDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  @ApiPropertyOptional({ example: '987654321' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?\d{6,15}$/, { message: 'El teléfono debe tener entre 6 y 15 dígitos' })
  telefono?: string;
}

export class AdjustPointsDto {
  @ApiProperty({ enum: tipo_movimiento_puntos })
  @IsEnum(tipo_movimiento_puntos)
  tipo!: tipo_movimiento_puntos;

  @ApiProperty({ example: 50, minimum: 1 })
  @IsInt()
  @Min(1)
  puntos!: number;

  @ApiPropertyOptional({ example: 'Cortesía del local', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Solo ADMIN_GLOBAL: los demás heredan la sucursal del token',
  })
  @IsOptional()
  @IsUUID()
  sucursalId?: string;
}

export class ListCustomersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: segmento_cliente })
  @IsOptional()
  @IsEnum(segmento_cliente)
  segmento?: segmento_cliente;

  @ApiPropertyOptional({ description: 'Busca por nombre o teléfono' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;
}

export class UpdateLoyaltyConfigDto {
  @ApiPropertyOptional({ example: 1, description: 'Puntos por cada sol consumido' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  puntosPorMoneda?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  caducidadMeses?: number;

  @ApiPropertyOptional({ example: 5, description: 'Visitas para ser FRECUENTE' })
  @IsOptional()
  @IsInt()
  @Min(1)
  umbralFrecuente?: number;

  @ApiPropertyOptional({ example: 20, description: 'Visitas para ser VIP' })
  @IsOptional()
  @IsInt()
  @Min(2)
  umbralVip?: number;
}

export class ListPointsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: tipo_movimiento_puntos })
  @IsOptional()
  @IsEnum(tipo_movimiento_puntos)
  tipo?: tipo_movimiento_puntos;
}

export type { segmento_cliente };
