import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { estado_orden } from '../../../generated/prisma/enums.js';

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: estado_orden, example: 'EN_COCINA' })
  @IsEnum(estado_orden)
  estado!: estado_orden;
}
