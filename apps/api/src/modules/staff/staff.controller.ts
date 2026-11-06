import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { StaffService } from './staff.service.js';
import {
  CalculateTipsDto,
  CreateShiftDto,
  ListDayQueryDto,
  ListEmployeesQueryDto,
  MarkAttendanceDto,
} from './dto/staff.dto.js';

@ApiTags('staff')
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get('employees')
  @ApiOperation({ summary: 'Personal de la sucursal con su rol' })
  listEmployees(@Query() query: ListEmployeesQueryDto) {
    return this.staffService.listEmployees(query);
  }

  @Get('shifts')
  @ApiOperation({ summary: 'Plan de turnos del día' })
  listShifts(@Query() query: ListDayQueryDto) {
    return this.staffService.listShifts(query);
  }

  @Post('shifts')
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL')
  @ApiOperation({ summary: 'Asigna un turno (empleado + día + bloque)' })
  createShift(@Body() dto: CreateShiftDto) {
    return this.staffService.createShift(dto);
  }

  @Delete('shifts/:id')
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL')
  @ApiOperation({ summary: 'Quita un turno del plan' })
  removeShift(@Param('id', ParseUUIDPipe) id: string) {
    return this.staffService.removeShift(id);
  }

  @Get('attendance')
  @ApiOperation({ summary: 'Marcaciones del día' })
  listAttendance(@Query() query: ListDayQueryDto) {
    return this.staffService.listAttendance(query);
  }

  @Post('attendance')
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL', 'CAJERO')
  @ApiOperation({ summary: 'Marca la asistencia (upsert por empleado y día)' })
  markAttendance(@Body() dto: MarkAttendanceDto) {
    return this.staffService.markAttendance(dto);
  }

  @Get('tips')
  @ApiOperation({ summary: 'Últimos pozos de propinas' })
  listPools(@Query() query: ListDayQueryDto) {
    return this.staffService.listPools(query);
  }

  @Get('tips/:id')
  @ApiOperation({ summary: 'Pozo con su reparto por empleado' })
  getPool(@Param('id', ParseUUIDPipe) id: string) {
    return this.staffService.getPool(id);
  }

  @Post('tips/calculate')
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL')
  @ApiOperation({ summary: 'Calcula y reparte el pozo del día entre los presentes' })
  calculateTips(@Body() dto: CalculateTipsDto) {
    return this.staffService.calculateTips(dto);
  }

  @Post('tips/:id/confirm')
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL')
  @ApiOperation({ summary: 'Marca el pozo como repartido (idempotente)' })
  confirmPool(@Param('id', ParseUUIDPipe) id: string) {
    return this.staffService.confirmPool(id);
  }
}
