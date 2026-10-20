import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDishDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoriaId!: string;

  @ApiProperty({ example: 'CEV-001' })
  @IsString()
  @MaxLength(40)
  sku!: string;

  @ApiProperty({ example: 'Ceviche clásico' })
  @IsString()
  @MaxLength(160)
  nombre!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fotoUrl?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({ example: 8.5, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costoReal?: number;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { each: true })
  grupoIds?: string[];
}

export class UpdateDishDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoriaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fotoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  costoReal?: number;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { each: true })
  grupoIds?: string[];
}
