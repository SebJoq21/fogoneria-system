import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import {
  categoria_gasto,
  estado_pago_gasto,
  metodo_pago,
} from '../../../generated/prisma/enums.js';
import { Type } from 'class-transformer';

export class CreateExpenseDto {
  @ApiProperty({ example: 'Compra de carbón', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  concepto!: string;

  @ApiProperty({ example: 350.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto!: number;

  @ApiProperty({ enum: categoria_gasto })
  @IsEnum(categoria_gasto)
  categoria!: categoria_gasto;

  @ApiPropertyOptional({ format: 'uuid', description: 'Solo ADMIN_GLOBAL: los demás heredan la sucursal del token' })
  @IsOptional()
  @IsUUID()
  sucursalId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  proveedorId?: string;

  @ApiPropertyOptional({ example: '2026-12-15', description: 'Vencimiento (día, hora de Lima)' })
  @IsOptional()
  @IsDateString()
  vencimiento?: string;
}

export class UpdateExpenseDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  concepto?: string;

  @ApiPropertyOptional({ example: 320 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto?: number;

  @ApiPropertyOptional({ enum: categoria_gasto })
  @IsOptional()
  @IsEnum(categoria_gasto)
  categoria?: categoria_gasto;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  proveedorId?: string;

  @ApiPropertyOptional({ example: '2026-12-15' })
  @IsOptional()
  @IsDateString()
  vencimiento?: string;
}

export class PayExpenseDto {
  @ApiProperty({
    enum: metodo_pago,
    description: 'EFECTIVO descuenta del turno abierto; el resto solo cambia el estado',
  })
  @IsEnum(metodo_pago)
  metodo!: metodo_pago;
}

export class ListExpensesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: estado_pago_gasto })
  @IsOptional()
  @IsEnum(estado_pago_gasto)
  estadoPago?: estado_pago_gasto;

  @ApiPropertyOptional({ enum: categoria_gasto })
  @IsOptional()
  @IsEnum(categoria_gasto)
  categoria?: categoria_gasto;

  @ApiPropertyOptional({ description: 'Solo los pendientes con vencimiento pasado' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  vencidos?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sucursalId?: string;
}
