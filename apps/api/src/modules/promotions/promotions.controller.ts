import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { PromotionsService } from './promotions.service.js';
import {
  CreateComboDto,
  CreateCouponDto,
  ListCouponsQueryDto,
  UpdateComboDto,
  UpdateCouponDto,
  ValidateCouponDto,
} from './dto/promotions.dto.js';

@ApiTags('promotions')
@ApiBearerAuth()
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get('combos')
  @ApiOperation({ summary: 'Combos con precio de referencia y ahorro' })
  listCombos() {
    return this.promotionsService.listCombos();
  }

  @Post('combos')
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL')
  @ApiOperation({ summary: 'Crea un combo (el precio no puede superar sus partes)' })
  createCombo(@Body() dto: CreateComboDto) {
    return this.promotionsService.createCombo(dto);
  }

  @Patch('combos/:id')
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL')
  @ApiOperation({ summary: 'Actualiza un combo y sus platos' })
  updateCombo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateComboDto,
  ) {
    return this.promotionsService.updateCombo(id, dto);
  }

  @Delete('combos/:id')
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL')
  @ApiOperation({ summary: 'Da de baja un combo (baja lógica)' })
  removeCombo(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotionsService.removeCombo(id);
  }

  @Get('coupons')
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL', 'CAJERO')
  @ApiOperation({ summary: 'Cupones de la empresa' })
  listCoupons(@Query() query: ListCouponsQueryDto) {
    return this.promotionsService.listCoupons(query);
  }

  @Post('coupons')
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL')
  @ApiOperation({ summary: 'Crea un cupón con su límite de usos' })
  createCoupon(@Body() dto: CreateCouponDto) {
    return this.promotionsService.createCoupon(dto);
  }

  @Patch('coupons/:id')
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL')
  @ApiOperation({ summary: 'Actualiza un cupón' })
  updateCoupon(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.promotionsService.updateCoupon(id, dto);
  }

  @Delete('coupons/:id')
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL')
  @ApiOperation({ summary: 'Da de baja un cupón (baja lógica)' })
  removeCoupon(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotionsService.removeCoupon(id);
  }

  @Post('coupons/:codigo/validate')
  @ApiOperation({ summary: 'Calcula el descuento de un cupón sin consumirlo' })
  validateCoupon(
    @Param('codigo') codigo: string,
    @Body() dto: ValidateCouponDto,
  ) {
    return this.promotionsService.validateCoupon(codigo, dto.subtotal);
  }

  @Get('schedule')
  @ApiOperation({ summary: 'Reglas horarias activas y si aplican ahora' })
  schedule() {
    return this.promotionsService.schedule();
  }
}
