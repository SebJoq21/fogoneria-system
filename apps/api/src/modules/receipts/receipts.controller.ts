import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ReceiptsService } from './receipts.service.js';
import {
  CreateReceiptDto,
  ListReceiptsQueryDto,
  VoidReceiptDto,
} from './dto/receipts.dto.js';

@ApiTags('receipts')
@ApiBearerAuth()
@Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL', 'CAJERO')
@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Get()
  @ApiOperation({ summary: 'Comprobantes emitidos, con filtros por día, tipo y estado' })
  list(@Query() query: ListReceiptsQueryDto) {
    return this.receiptsService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un comprobante y su desglose de IGV' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.receiptsService.findOne(id);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Emite el comprobante de una comanda pagada' })
  create(@Body() dto: CreateReceiptDto) {
    return this.receiptsService.create(dto);
  }

  @Post(':id/void')
  @HttpCode(200)
  @ApiOperation({ summary: 'Anula el comprobante (la reversión la hace la base)' })
  void(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VoidReceiptDto) {
    return this.receiptsService.void(id, dto.motivo);
  }
}
