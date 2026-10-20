import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  plan_suscripcion,
  rango_sucursales,
} from '../../../generated/prisma/enums.js';

/** Alta pública de un restaurante: crea el lead y su tenant en trial. */
export class SubmitOnboardingDto {
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

  @ApiPropertyOptional({ example: 'https://cdn.fogoneria.pe/logo.png' })
  @IsOptional()
  @IsString()
  @MaxLength(2_800_000, { message: 'El logo es demasiado grande (máximo 2 MB)' })
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'Sede principal' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sucursalNombre?: string;

  @ApiPropertyOptional({ example: '999888777' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @ApiPropertyOptional({ enum: rango_sucursales, example: 'UNO' })
  @IsOptional()
  @IsEnum(rango_sucursales)
  rangoSucursales?: rango_sucursales;

  @ApiPropertyOptional({ enum: plan_suscripcion, example: 'TRIAL' })
  @IsOptional()
  @IsEnum(plan_suscripcion)
  plan?: plan_suscripcion;

  @ApiProperty({ example: 'María Torres' })
  @IsString()
  @MaxLength(160)
  nombreAdmin!: string;

  @ApiProperty({ example: 'admin@elfuego.pe' })
  @IsEmail()
  emailAdmin!: string;

  @ApiProperty({ example: 'Fogoneria123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiPropertyOptional({ example: 'Carta cargada: carta-fuego.pdf' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}
