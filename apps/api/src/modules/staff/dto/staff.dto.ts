import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  bloque_turno,
  estado_asistencia,
} from '../../../generated/prisma/enums.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export class SucursalQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sucursalId?: string;
}

export class ListEmployeesQueryDto extends SucursalQueryDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ListDayQueryDto extends SucursalQueryDto {
  @ApiPropertyOptional({ example: '2026-11-06', description: 'Día en hora de Lima' })
  @IsOptional()
  @IsString()
  @Matches(FECHA, { message: 'fecha debe ser YYYY-MM-DD' })
  fecha?: string;
}

export class CreateShiftDto extends SucursalQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  empleadoId!: string;

  @ApiProperty({ example: '2026-11-07' })
  @IsString()
  @Matches(FECHA, { message: 'fecha debe ser YYYY-MM-DD' })
  fecha!: string;

  @ApiProperty({ enum: bloque_turno })
  @IsEnum(bloque_turno)
  bloque!: bloque_turno;
}

export class MarkAttendanceDto extends SucursalQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  empleadoId!: string;

  @ApiPropertyOptional({ example: '2026-11-06' })
  @IsOptional()
  @IsString()
  @Matches(FECHA, { message: 'fecha debe ser YYYY-MM-DD' })
  fecha?: string;

  @ApiProperty({ enum: estado_asistencia })
  @IsEnum(estado_asistencia)
  estado!: estado_asistencia;

  @ApiPropertyOptional({ example: '2026-11-06T13:02:00.000Z' })
  @IsOptional()
  @IsDateString()
  horaEntrada?: string;

  @ApiPropertyOptional({ example: '2026-11-06T22:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  horaSalida?: string;

  @ApiPropertyOptional({ example: 'PIN', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  fuente?: string;
}

export class CalculateTipsDto extends SucursalQueryDto {
  @ApiPropertyOptional({ example: '2026-11-06', description: 'Por defecto, hoy en Lima' })
  @IsOptional()
  @IsString()
  @Matches(FECHA, { message: 'fecha debe ser YYYY-MM-DD' })
  fecha?: string;
}
