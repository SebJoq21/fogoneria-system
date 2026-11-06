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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CatalogService } from './catalog.service.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';
import { CreateDishDto, UpdateDishDto } from './dto/dish.dto.js';
import { ListCatalogQueryDto } from './dto/list-catalog.dto.js';
import {
  AssignModifierGroupsDto,
  CreateModifierGroupDto,
  UpdateModifierGroupDto,
} from './dto/modifier-group.dto.js';

const CATALOG_WRITERS = ['ADMIN_GLOBAL', 'GERENTE_SUCURSAL'] as const;

@ApiTags('catalog')
@ApiBearerAuth()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  // ─── Categorías ───────────────────────────────────────────────────────────

  @Get('categories')
  @ApiOperation({ summary: 'Lista las categorías del tenant' })
  listCategories() {
    return this.catalog.listCategories();
  }

  @Post('categories')
  @Roles(...CATALOG_WRITERS)
  @ApiOperation({ summary: 'Crea una categoría' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.catalog.createCategory(dto);
  }

  @Patch('categories/:id')
  @Roles(...CATALOG_WRITERS)
  @ApiOperation({ summary: 'Actualiza una categoría' })
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.catalog.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @Roles(...CATALOG_WRITERS)
  @ApiOperation({ summary: 'Desactiva una categoría (borrado lógico)' })
  deleteCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.deactivateCategory(id);
  }

  // ─── Platos ───────────────────────────────────────────────────────────────

  @Get('dishes')
  @ApiOperation({ summary: 'Lista platos con búsqueda, categoría y paginación' })
  listDishes(@Query() query: ListCatalogQueryDto) {
    return this.catalog.listDishes(query);
  }

  @Get('dishes/:id')
  @ApiOperation({ summary: 'Detalle de un plato con precios y modificadores' })
  getDish(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.getDish(id);
  }

  @Post('dishes')
  @Roles(...CATALOG_WRITERS)
  @ApiOperation({ summary: 'Crea un plato' })
  createDish(@Body() dto: CreateDishDto) {
    return this.catalog.createDish(dto);
  }

  @Patch('dishes/:id')
  @Roles(...CATALOG_WRITERS)
  @ApiOperation({ summary: 'Actualiza un plato' })
  updateDish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDishDto,
  ) {
    return this.catalog.updateDish(id, dto);
  }

  @Delete('dishes/:id')
  @Roles(...CATALOG_WRITERS)
  @ApiOperation({ summary: 'Borra lógicamente un plato' })
  deleteDish(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.deleteDish(id);
  }

  @Put('dishes/:id/modifier-groups')
  @Roles(...CATALOG_WRITERS)
  @ApiOperation({ summary: 'Reemplaza los grupos de modificadores de un plato' })
  assignGroups(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignModifierGroupsDto,
  ) {
    return this.catalog.assignModifierGroups(id, dto.grupoIds);
  }

  // ─── Grupos de modificadores ───────────────────────────────────────────────

  @Get('modifier-groups')
  @ApiOperation({ summary: 'Lista los grupos de modificadores y sus opciones' })
  listGroups() {
    return this.catalog.listModifierGroups();
  }

  @Post('modifier-groups')
  @Roles(...CATALOG_WRITERS)
  @ApiOperation({ summary: 'Crea un grupo de modificadores con opciones' })
  createGroup(@Body() dto: CreateModifierGroupDto) {
    return this.catalog.createModifierGroup(dto);
  }

  @Patch('modifier-groups/:id')
  @Roles(...CATALOG_WRITERS)
  @ApiOperation({ summary: 'Actualiza un grupo y reemplaza sus opciones' })
  updateGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateModifierGroupDto,
  ) {
    return this.catalog.updateModifierGroup(id, dto);
  }

  @Delete('modifier-groups/:id')
  @Roles(...CATALOG_WRITERS)
  @ApiOperation({ summary: 'Desactiva un grupo de modificadores' })
  deleteGroup(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.deleteModifierGroup(id);
  }
}
