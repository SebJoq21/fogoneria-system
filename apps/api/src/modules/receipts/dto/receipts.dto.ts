import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import {
  estado_comprobante,
  tipo_comprobante,
} from '../../../generated/prisma/enums.js';

export class CreateReceiptDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ordenId!: string;

  @ApiProperty({ enum: tipo_comprobante })
  @IsEnum(tipo_comprobante)
  tipo!: tipo_comprobante;

  @ApiPropertyOptional({
    example: '20123456786',
    description: 'RUC (factura) o DNI (boleta). Obligatorio en FACTURA.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{8,11}$/, { message: 'clienteRef debe ser un DNI o RUC numérico' })
  clienteRef?: string;
}

export class VoidReceiptDto {
  @ApiProperty({
    example: 'Cliente desistió de la compra',
    minLength: 5,
    maxLength: 200,
  })
  @IsString()
  @Length(5, 200)
  motivo!: string;
}

export class ListReceiptsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: '2026-11-06',
    description: 'Día completo en hora de Lima',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe ser YYYY-MM-DD' })
  fecha?: string;

  @ApiPropertyOptional({ enum: tipo_comprobante })
  @IsOptional()
  @IsEnum(tipo_comprobante)
  tipo?: tipo_comprobante;

  @ApiPropertyOptional({ enum: estado_comprobante })
  @IsOptional()
  @IsEnum(estado_comprobante)
  estado?: estado_comprobante;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sucursalId?: string;
}

/** Desglose del IGV: se deriva del total con la tasa vigente, no se guarda. */
export interface ReceiptIgv {
  base: number;
  igv: number;
  total: number;
  tasa: number;
}
