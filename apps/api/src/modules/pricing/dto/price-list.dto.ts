import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreatePriceListDto {
  @ApiProperty({ example: 'Carta salón' })
  @IsString()
  @MaxLength(120)
  nombre!: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  vigenciaDesde?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  vigenciaHasta?: string;
}

export class UpdatePriceListDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  vigenciaDesde?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  vigenciaHasta?: string;
}

export class PriceItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  platoId!: string;

  @ApiProperty({ example: 24.9, minimum: 0 })
  @IsNumber()
  @Min(0)
  precio!: number;
}

export class SetPricesDto {
  @ApiProperty({ type: [PriceItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PriceItemDto)
  items!: PriceItemDto[];
}
