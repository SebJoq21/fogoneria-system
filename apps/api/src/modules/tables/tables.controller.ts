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
import { TablesService } from './tables.service.js';
import {
  CreateTableDto,
  ListTablesQueryDto,
  UpdateTableDto,
  UpdateTableStatusDto,
} from './dto/table.dto.js';

/** Bloquear/liberar mesa es decisión de sucursal (ver apps/web/AGENTS.md). */
const TABLE_ADMINS = ['ADMIN_GLOBAL', 'GERENTE_SUCURSAL'] as const;

@ApiTags('tables')
@ApiBearerAuth()
@Controller('tables')
export class TablesController {
  constructor(private readonly tables: TablesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista las mesas de la sucursal (filtros estado/zona)' })
  list(@Query() query: ListTablesQueryDto) {
    return this.tables.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una mesa' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tables.findOne(id);
  }

  @Post()
  @Roles(...TABLE_ADMINS)
  @ApiOperation({ summary: 'Crea una mesa en la sucursal del token' })
  create(@Body() dto: CreateTableDto) {
    return this.tables.create(dto);
  }

  @Patch(':id')
  @Roles(...TABLE_ADMINS)
  @ApiOperation({ summary: 'Actualiza número, capacidad, zona o forma' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.tables.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(...TABLE_ADMINS)
  @ApiOperation({
    summary:
      'Bloquea o libera una mesa (OCUPADA/RESERVADA son derivados del sistema)',
  })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTableStatusDto,
  ) {
    return this.tables.updateStatus(id, dto);
  }

  @Delete(':id')
  @Roles(...TABLE_ADMINS)
  @ApiOperation({ summary: 'Da de baja la mesa (borrado lógico, exige mesa libre)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tables.remove(id);
  }
}
