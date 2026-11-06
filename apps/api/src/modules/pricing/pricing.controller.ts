import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { PricingService } from './pricing.service.js';
import {
  CreatePriceListDto,
  SetPricesDto,
  UpdatePriceListDto,
} from './dto/price-list.dto.js';

const PRICING_WRITERS = ['ADMIN_GLOBAL', 'GERENTE_SUCURSAL'] as const;

@ApiTags('pricing')
@ApiBearerAuth()
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get('price-lists')
  @ApiOperation({ summary: 'Lista las listas de precios del tenant' })
  list() {
    return this.pricing.list();
  }

  @Post('price-lists')
  @Roles(...PRICING_WRITERS)
  @ApiOperation({ summary: 'Crea una lista de precios' })
  create(@Body() dto: CreatePriceListDto) {
    return this.pricing.create(dto);
  }

  @Patch('price-lists/:id')
  @Roles(...PRICING_WRITERS)
  @ApiOperation({ summary: 'Actualiza una lista de precios' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePriceListDto,
  ) {
    return this.pricing.update(id, dto);
  }

  @Delete('price-lists/:id')
  @Roles(...PRICING_WRITERS)
  @ApiOperation({ summary: 'Desactiva una lista de precios' })
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricing.deactivate(id);
  }

  @Post('price-lists/:id/activate')
  @Roles(...PRICING_WRITERS)
  @ApiOperation({ summary: 'Activa una lista y desactiva el resto' })
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricing.activate(id);
  }

  @Get('price-lists/:id/prices')
  @ApiOperation({ summary: 'Precios de una lista' })
  prices(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricing.getPrices(id);
  }

  @Put('price-lists/:id/prices')
  @Roles(...PRICING_WRITERS)
  @ApiOperation({ summary: 'Crea o actualiza precios de una lista (upsert masivo)' })
  setPrices(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPricesDto,
  ) {
    return this.pricing.setPrices(id, dto.items);
  }

  @Get('resolve')
  @ApiOperation({ summary: 'Resuelve el precio de un plato por lista o lista activa' })
  @ApiQuery({ name: 'platoId', required: true, format: 'uuid' })
  @ApiQuery({ name: 'listaId', required: false, format: 'uuid' })
  resolve(
    @Query('platoId', ParseUUIDPipe) platoId: string,
    @Query('listaId', new ParseUUIDPipe({ optional: true })) listaId?: string,
  ) {
    return this.pricing.resolvePrice(platoId, listaId);
  }
}
