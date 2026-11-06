import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import {
  metodo_pago,
  tipo_movimiento_caja,
} from '../../../generated/prisma/enums.js';

/** Sucursal opcional: los roles operativos la heredan del token. */
class SucursalQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sucursalId?: string;
}

export class CurrentShiftQueryDto extends SucursalQueryDto {}

export class OpenShiftDto extends SucursalQueryDto {
  @ApiProperty({ example: 200, description: 'Fondo con el que abre la caja' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fondoApertura!: number;
}

export class CloseShiftDto {
  @ApiProperty({ example: 850.5, description: 'Efectivo contado por el cajero' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  efectivoContado!: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}

export class CreateMovementDto extends SucursalQueryDto {
  @ApiProperty({ enum: tipo_movimiento_caja })
  @IsEnum(tipo_movimiento_caja)
  tipo!: tipo_movimiento_caja;

  @ApiProperty({ example: 'Pago a proveedor de verduras', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  concepto!: string;

  @ApiProperty({ example: 120.4 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto!: number;

  @ApiProperty({ enum: metodo_pago })
  @IsEnum(metodo_pago)
  metodo!: metodo_pago;
}

export class ChargeOrderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ordenId!: string;

  @ApiProperty({ enum: metodo_pago })
  @IsEnum(metodo_pago)
  metodo!: metodo_pago;

  @ApiPropertyOptional({
    example: 36.5,
    description: 'Importe a cobrar; por defecto, lo que falta de la comanda',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto?: number;

  @ApiPropertyOptional({ example: 5, description: 'Propina de este cobro' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  propina?: number;
}

export class ListShiftsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sucursalId?: string;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}

export class ListMovementsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Por defecto, el turno abierto',
  })
  @IsOptional()
  @IsUUID()
  turnoId?: string;

  @ApiPropertyOptional({ enum: tipo_movimiento_caja })
  @IsOptional()
  @IsEnum(tipo_movimiento_caja)
  tipo?: tipo_movimiento_caja;
}
