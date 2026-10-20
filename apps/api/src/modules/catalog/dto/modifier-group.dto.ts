import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ModifierOptionDto {
  @ApiProperty({ example: 'Sin ají' })
  @IsString()
  @MaxLength(120)
  nombre!: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioExtra?: number;
}

export class CreateModifierGroupDto {
  @ApiProperty({ example: 'Término de la carne' })
  @IsString()
  @MaxLength(120)
  nombre!: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  obligatorio?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  permiteMultiple?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({ type: [ModifierOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModifierOptionDto)
  opciones?: ModifierOptionDto[];
}

export class UpdateModifierGroupDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  obligatorio?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  permiteMultiple?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({ type: [ModifierOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModifierOptionDto)
  opciones?: ModifierOptionDto[];
}

export class AssignModifierGroupsDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  grupoIds!: string[];
}
