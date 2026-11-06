import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { estado_reserva } from '../../../generated/prisma/enums.js';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';

export class CreateReservationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  mesaId!: string;

  @ApiProperty({ example: 'Familia Rojas' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  clienteNombre!: string;

  @ApiPropertyOptional({ example: '987654321' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @ApiProperty({ example: 4, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  nroComensales!: number;

  @ApiProperty({ example: '2026-10-27T20:00:00-05:00' })
  @IsDateString()
  fechaHora!: string;

  @ApiPropertyOptional({ example: 'Presencial' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  canal?: string;

  @ApiPropertyOptional({ example: 'Mesa junto a la ventana' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}

export class UpdateReservationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  mesaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  clienteNombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  nroComensales?: number;

  @ApiPropertyOptional({ example: '2026-10-27T21:00:00-05:00' })
  @IsOptional()
  @IsDateString()
  fechaHora?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  canal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}

export class UpdateReservationStatusDto {
  @ApiProperty({ enum: estado_reserva, example: 'CONFIRMADA' })
  @IsEnum(estado_reserva)
  estado!: estado_reserva;
}

export class ListReservationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: '2026-10-27',
    description: 'Día completo en hora de Lima (UTC-05:00)',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fecha debe tener formato YYYY-MM-DD',
  })
  @IsDateString({}, { message: 'fecha debe ser una fecha real' })
  fecha?: string;

  @ApiPropertyOptional({ enum: estado_reserva })
  @IsOptional()
  @IsEnum(estado_reserva)
  estado?: estado_reserva;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  mesaId?: string;
}
