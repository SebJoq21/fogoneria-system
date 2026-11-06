import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import {
  BOARD_DIAS,
  BOARD_DIAS_MAX,
  BOARD_LIMITE,
  BOARD_LIMITE_MAX,
} from '../orders.sla.js';

/**
 * Query del tablero del KDS (AYCDS-30).
 *
 * La ventana y el límite existen para que la consulta no recorra el histórico:
 * el KDS solo necesita lo abierto de los últimos días.
 */
export class BoardOrdersQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Solo ADMIN_GLOBAL: los demás roles la heredan del token',
  })
  @IsOptional()
  @IsUUID()
  sucursalId?: string;

  @ApiPropertyOptional({
    default: BOARD_DIAS,
    maximum: BOARD_DIAS_MAX,
    description: 'Días hacia atrás que se consideran',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(BOARD_DIAS_MAX)
  dias?: number;

  @ApiPropertyOptional({
    default: BOARD_LIMITE,
    maximum: BOARD_LIMITE_MAX,
    description: 'Máximo de comandas abiertas en el tablero',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(BOARD_LIMITE_MAX)
  limite?: number;
}
