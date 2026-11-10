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
import { ExpensesService } from './expenses.service.js';
import {
  CreateExpenseDto,
  ListExpensesQueryDto,
  PayExpenseDto,
  UpdateExpenseDto,
} from './dto/expenses.dto.js';

@ApiTags('expenses')
@ApiBearerAuth()
@Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL', 'CAJERO')
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @ApiOperation({ summary: 'Gastos con filtros por estado, categoría y vencidos' })
  list(@Query() query: ListExpensesQueryDto) {
    return this.expensesService.list(query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Por pagar, vencido y pagado del mes' })
  summary(@Query() query: ListExpensesQueryDto) {
    return this.expensesService.summary(query);
  }

  @Post()
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL')
  @ApiOperation({ summary: 'Registra un gasto (cuenta por pagar)' })
  create(@Body() dto: CreateExpenseDto) {
    return this.expensesService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN_GLOBAL', 'GERENTE_SUCURSAL')
  @ApiOperation({ summary: 'Edita un gasto no pagado en caja' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateExpenseDto) {
    return this.expensesService.update(id, dto);
  }

  @Post(':id/pay')
  @ApiOperation({
    summary: 'Paga el gasto; en efectivo descuenta del turno abierto',
  })
  pay(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PayExpenseDto) {
    return this.expensesService.pay(id, dto.metodo);
  }
}
