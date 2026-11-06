import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CashService } from './cash.service.js';
import {
  ChargeOrderDto,
  CloseShiftDto,
  CreateMovementDto,
  CurrentShiftQueryDto,
  ListMovementsQueryDto,
  ListShiftsQueryDto,
  OpenShiftDto,
} from './dto/cash.dto.js';

@ApiTags('cash')
@ApiBearerAuth()
@Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL', 'CAJERO')
@Controller('cash')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Get('shifts/current')
  @ApiOperation({ summary: 'Turno de caja abierto y su arqueo' })
  current(@Query() query: CurrentShiftQueryDto) {
    return this.cashService.current(query.sucursalId);
  }

  @Get('shifts')
  @ApiOperation({ summary: 'Historial de turnos de caja' })
  listShifts(@Query() query: ListShiftsQueryDto) {
    return this.cashService.listShifts(query);
  }

  @Post('shifts')
  @ApiOperation({ summary: 'Abre un turno de caja con fondo' })
  open(@Body() dto: OpenShiftDto) {
    return this.cashService.open(dto.sucursalId, dto.fondoApertura);
  }

  @Patch('shifts/:id/close')
  @ApiOperation({ summary: 'Cierra el turno con arqueo de efectivo' })
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseShiftDto,
  ) {
    return this.cashService.close(id, dto);
  }

  @Get('movements')
  @ApiOperation({ summary: 'Movimientos del turno (por defecto, el abierto)' })
  movements(@Query() query: ListMovementsQueryDto) {
    return this.cashService.movements(query);
  }

  @Post('movements')
  @HttpCode(201)
  @ApiOperation({ summary: 'Ingreso o egreso manual de caja' })
  createMovement(@Body() dto: CreateMovementDto) {
    return this.cashService.createMovement(dto);
  }

  @Post('charges')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Cobra una comanda (admite parciales y propina)',
  })
  charge(@Body() dto: ChargeOrderDto) {
    return this.cashService.charge(dto);
  }
}
