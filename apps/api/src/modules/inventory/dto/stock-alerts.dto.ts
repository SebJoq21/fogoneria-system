import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

const ESTADOS = ['AGOTADO', 'BAJO', 'OPTIMO'] as const;

export class StockStatusQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Solo ADMIN_GLOBAL (sin sucursal en el token).',
  })
  @IsOptional()
  @IsUUID()
  sucursalId?: string;

  @ApiPropertyOptional({ enum: ESTADOS })
  @IsOptional()
  @IsIn(ESTADOS)
  estado?: (typeof ESTADOS)[number];
}
