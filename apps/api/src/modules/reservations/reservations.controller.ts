import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ReservationsService } from './reservations.service.js';
import {
  CreateReservationDto,
  ListReservationsQueryDto,
  UpdateReservationDto,
  UpdateReservationStatusDto,
} from './dto/reservation.dto.js';

/** Mesero y cajero toman reservas; el resto de roles solo consulta. */
const RESERVATION_WRITERS = [
  'ADMIN_GLOBAL',
  'GERENTE_SUCURSAL',
  'MESERO',
  'CAJERO',
] as const;

@ApiTags('reservations')
@ApiBearerAuth()
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista reservas por día (hora de Lima), estado o mesa' })
  list(@Query() query: ListReservationsQueryDto) {
    return this.reservations.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una reserva' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservations.findOne(id);
  }

  @Post()
  @Roles(...RESERVATION_WRITERS)
  @ApiOperation({ summary: 'Crea una reserva validando aforo y solapamiento' })
  create(@Body() dto: CreateReservationDto) {
    return this.reservations.create(dto);
  }

  @Patch(':id')
  @Roles(...RESERVATION_WRITERS)
  @ApiOperation({ summary: 'Edita una reserva por confirmar' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservations.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(...RESERVATION_WRITERS)
  @ApiOperation({
    summary: 'Avanza la reserva (confirmar, ejecutar, cancelar, no-show)',
  })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReservationStatusDto,
  ) {
    return this.reservations.updateStatus(id, dto.estado);
  }
}
