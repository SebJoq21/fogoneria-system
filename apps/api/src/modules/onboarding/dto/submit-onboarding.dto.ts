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
import { rango_sucursales } from '../../../generated/prisma/enums.js';

/**
 * Alta pública de un restaurante: crea el lead y su tenant en trial.
 * El plan no se acepta aquí (siempre entra como TRIAL); cambiarlo es tarea de
 * la consola SaaS autenticada.
 */

/** URL http(s) o imagen embebida como data URL (`data:image/png;base64,…`). */
const LOGO_PATTERN = /^(https?:\/\/\S+|data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+)$/i;

export class SubmitOnboardingDto {
  @ApiProperty({ example: 'Parrilla El Fuego S.A.C.' })
  @IsString()
  @MinLength(3, { message: 'La razón social debe tener al menos 3 caracteres' })
  @MaxLength(160)
  nombreLegal!: string;

  @ApiPropertyOptional({ example: 'El Fuego' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  nombreComercial?: string;

  @ApiProperty({ example: '20123456786' })
  @Matches(/^\d{11}$/, { message: 'El RUC debe tener 11 dígitos' })
  ruc!: string;

  @ApiPropertyOptional({ example: 'https://cdn.fogoneria.pe/logo.png' })
  @IsOptional()
  @IsString()
  @Matches(LOGO_PATTERN, {
    message: 'El logo debe ser una URL http(s) o una imagen en base64',
  })
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

  @ApiProperty({ example: 'María Torres' })
  @IsString()
  @MinLength(3, { message: 'El nombre del administrador debe tener al menos 3 caracteres' })
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
