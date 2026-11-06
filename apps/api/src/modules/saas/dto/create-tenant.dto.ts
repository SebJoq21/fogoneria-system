import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { plan_suscripcion } from '../../../generated/prisma/enums.js';

export class CreateTenantDto {
  @ApiProperty({ example: 'Parrilla El Fuego S.A.C.' })
  @IsString()
  @MaxLength(160)
  nombreLegal!: string;

  @ApiPropertyOptional({ example: 'El Fuego' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  nombreComercial?: string;

  @ApiProperty({ example: '20123456789' })
  @Matches(/^\d{11}$/, { message: 'El RUC debe tener 11 dígitos' })
  ruc!: string;

  @ApiProperty({ example: 'admin@elfuego.pe' })
  @IsEmail()
  emailAdmin!: string;

  @ApiProperty({ example: 'María Torres' })
  @IsString()
  @MaxLength(160)
  nombreAdmin!: string;

  @ApiProperty({ example: 'Fogoneria123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ enum: plan_suscripcion, example: 'PROFESIONAL' })
  @IsOptional()
  @IsEnum(plan_suscripcion)
  plan?: plan_suscripcion;

  @ApiPropertyOptional({ example: 3, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limiteSucursales?: number;

  @ApiPropertyOptional({ example: 'Sede principal' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sucursalNombre?: string;

  @ApiPropertyOptional({ example: 14, minimum: 1, maximum: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  trialDias?: number;
}

export class SuspendTenantDto {
  @ApiProperty({ example: 'Factura vencida hace 15 días' })
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  motivo!: string;
}

export class ReactivateTenantDto {
  @ApiPropertyOptional({ example: 'Pago regularizado' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;
}

export class ChangePlanDto {
  @ApiProperty({ enum: plan_suscripcion, example: 'PROFESIONAL' })
  @IsEnum(plan_suscripcion)
  plan!: plan_suscripcion;

  @ApiProperty({ example: 249.9, minimum: 0 })
  @Type(() => Number)
  @Min(0)
  mrrMonto!: number;
}
