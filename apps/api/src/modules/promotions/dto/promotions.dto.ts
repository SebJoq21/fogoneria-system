import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { tipo_descuento_cupon } from '../../../generated/prisma/enums.js';

export class ComboPlateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  platoId!: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1)
  @Max(20)
  cantidad!: number;
}

export class CreateComboDto {
  @ApiProperty({ example: 'Combo parrillero', maxLength: 120 })
  @IsString()
  @MaxLength(120)
  nombre!: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;

  @ApiProperty({ example: 45.9 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precioFijo!: number;

  @ApiProperty({ type: [ComboPlateDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ComboPlateDto)
  platos!: ComboPlateDto[];
}

export class UpdateComboDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;

  @ApiPropertyOptional({ example: 45.9 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precioFijo?: number;

  @ApiPropertyOptional({ type: [ComboPlateDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ComboPlateDto)
  platos?: ComboPlateDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class CreateCouponDto {
  @ApiProperty({ example: 'VERANO20', maxLength: 40 })
  @IsString()
  @Matches(/^[A-Z0-9-]{3,40}$/, {
    message: 'El código debe ser A-Z, 0-9 o guion (3-40 caracteres)',
  })
  codigo!: string;

  @ApiProperty({ enum: tipo_descuento_cupon })
  @IsEnum(tipo_descuento_cupon)
  tipoDescuento!: tipo_descuento_cupon;

  @ApiProperty({ example: 10, description: 'Porcentaje (0-100) o monto en soles' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor!: number;

  @ApiProperty({ example: 100, minimum: 1 })
  @IsInt()
  @Min(1)
  limiteUsos!: number;

  @ApiProperty({ example: '2026-12-31' })
  @IsDateString()
  vencimiento!: string;
}

export class UpdateCouponDto {
  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor?: number;

  @ApiPropertyOptional({ example: 200, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limiteUsos?: number;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  vencimiento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ValidateCouponDto {
  @ApiProperty({ example: 120.5, description: 'Subtotal antes del descuento' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal!: number;
}

export class ListCouponsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  activo?: boolean;
}
