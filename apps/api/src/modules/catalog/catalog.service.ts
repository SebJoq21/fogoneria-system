import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TenantContextService } from '../../common/context/tenant-context.service.js';
import { paginationOf } from '../../common/dto/pagination.dto.js';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';
import type { CreateDishDto, UpdateDishDto } from './dto/dish.dto.js';
import type { ListCatalogQueryDto } from './dto/list-catalog.dto.js';
import type {
  CreateModifierGroupDto,
  UpdateModifierGroupDto,
} from './dto/modifier-group.dto.js';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  // ─── Categorías ───────────────────────────────────────────────────────────

  listCategories() {
    return this.prisma.scoped.categorias.findMany({
      orderBy: [{ posicion: 'asc' }, { nombre: 'asc' }],
      include: { _count: { select: { platos: true } } },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    try {
      return await this.prisma.scoped.categorias.create({
        data: {
          empresa_id: this.empresaId(),
          nombre: dto.nombre.trim(),
          posicion: dto.posicion ?? 0,
          activa: dto.activa ?? true,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ya existe una categoría con ese nombre');
      }
      throw error;
    }
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    await this.requireCategory(id);
    return this.prisma.scoped.categorias.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined ? { nombre: dto.nombre.trim() } : {}),
        ...(dto.posicion !== undefined ? { posicion: dto.posicion } : {}),
        ...(dto.activa !== undefined ? { activa: dto.activa } : {}),
      },
    });
  }

  async deactivateCategory(id: string) {
    await this.requireCategory(id);
    return this.prisma.scoped.categorias.update({
      where: { id },
      data: { activa: false },
    });
  }

  // ─── Platos ───────────────────────────────────────────────────────────────

  async listDishes(query: ListCatalogQueryDto) {
    const { skip, take } = paginationOf(query);
    const where = {
      deleted_at: null,
      ...(query.categoriaId ? { categoria_id: query.categoriaId } : {}),
      ...(query.activo !== undefined ? { activo: query.activo } : {}),
      ...(query.search
        ? {
            OR: [
              { nombre: { contains: query.search, mode: 'insensitive' as const } },
              { sku: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.scoped.platos.findMany({
        where,
        skip,
        take,
        orderBy: { nombre: 'asc' },
        include: {
          categorias: { select: { id: true, nombre: true } },
          precios_platos: true,
          platos_grupos_modificadores: { select: { grupo_id: true } },
        },
      }),
      this.prisma.scoped.platos.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async getDish(id: string) {
    const plato = await this.prisma.scoped.platos.findFirst({
      where: { id, deleted_at: null },
      include: {
        categorias: { select: { id: true, nombre: true } },
        precios_platos: { include: { listas_precios: true } },
        platos_grupos_modificadores: {
          include: {
            grupos_modificadores: { include: { opciones_modificadores: true } },
          },
        },
      },
    });
    if (!plato) throw new NotFoundException('Plato no encontrado');
    return plato;
  }

  async createDish(dto: CreateDishDto) {
    await this.requireCategory(dto.categoriaId);
    if (dto.grupoIds?.length) await this.requireGroups(dto.grupoIds);

    try {
      return await this.prisma.scoped.platos.create({
        data: {
          empresa_id: this.empresaId(),
          categoria_id: dto.categoriaId,
          sku: dto.sku.trim(),
          nombre: dto.nombre.trim(),
          descripcion: dto.descripcion ?? null,
          foto_url: dto.fotoUrl ?? null,
          activo: dto.activo ?? true,
          costo_real: dto.costoReal ?? 0,
          ...(dto.grupoIds?.length
            ? {
                platos_grupos_modificadores: {
                  create: dto.grupoIds.map((grupo_id) => ({ grupo_id })),
                },
              }
            : {}),
        },
        include: { categorias: true, precios_platos: true },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ya existe un plato con ese SKU');
      }
      throw error;
    }
  }

  async updateDish(id: string, dto: UpdateDishDto) {
    await this.requireDish(id);
    if (dto.categoriaId) await this.requireCategory(dto.categoriaId);
    if (dto.grupoIds) await this.requireGroups(dto.grupoIds);

    try {
      return await this.prisma.scoped.platos.update({
        where: { id },
        data: {
          ...(dto.categoriaId ? { categoria_id: dto.categoriaId } : {}),
          ...(dto.sku !== undefined ? { sku: dto.sku.trim() } : {}),
          ...(dto.nombre !== undefined ? { nombre: dto.nombre.trim() } : {}),
          ...(dto.descripcion !== undefined ? { descripcion: dto.descripcion } : {}),
          ...(dto.fotoUrl !== undefined ? { foto_url: dto.fotoUrl } : {}),
          ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
          ...(dto.costoReal !== undefined ? { costo_real: dto.costoReal } : {}),
          ...(dto.grupoIds
            ? {
                platos_grupos_modificadores: {
                  deleteMany: {},
                  create: dto.grupoIds.map((grupo_id) => ({ grupo_id })),
                },
              }
            : {}),
        },
        include: {
          categorias: true,
          precios_platos: true,
          platos_grupos_modificadores: true,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ya existe un plato con ese SKU');
      }
      throw error;
    }
  }

  async deleteDish(id: string) {
    await this.requireDish(id);
    return this.prisma.scoped.platos.update({
      where: { id },
      data: { activo: false, deleted_at: new Date() },
    });
  }

  async assignModifierGroups(platoId: string, grupoIds: string[]) {
    await this.requireDish(platoId);
    await this.requireGroups(grupoIds);
    return this.prisma.scoped.platos.update({
      where: { id: platoId },
      data: {
        platos_grupos_modificadores: {
          deleteMany: {},
          create: grupoIds.map((grupo_id) => ({ grupo_id })),
        },
      },
      include: { platos_grupos_modificadores: true },
    });
  }

  // ─── Grupos de modificadores ───────────────────────────────────────────────

  listModifierGroups() {
    return this.prisma.scoped.grupos_modificadores.findMany({
      orderBy: { nombre: 'asc' },
      include: { opciones_modificadores: true },
    });
  }

  async createModifierGroup(dto: CreateModifierGroupDto) {
    try {
      return await this.prisma.scoped.grupos_modificadores.create({
        data: {
          empresa_id: this.empresaId(),
          nombre: dto.nombre.trim(),
          obligatorio: dto.obligatorio ?? false,
          permite_multiple: dto.permiteMultiple ?? false,
          activo: dto.activo ?? true,
          ...(dto.opciones?.length
            ? {
                opciones_modificadores: {
                  create: dto.opciones.map((opcion) => ({
                    nombre: opcion.nombre.trim(),
                    precio_extra: opcion.precioExtra ?? 0,
                  })),
                },
              }
            : {}),
        },
        include: { opciones_modificadores: true },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ya existe un grupo con ese nombre');
      }
      throw error;
    }
  }

  async updateModifierGroup(id: string, dto: UpdateModifierGroupDto) {
    await this.requireGroup(id);
    return this.prisma.scoped.grupos_modificadores.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined ? { nombre: dto.nombre.trim() } : {}),
        ...(dto.obligatorio !== undefined ? { obligatorio: dto.obligatorio } : {}),
        ...(dto.permiteMultiple !== undefined
          ? { permite_multiple: dto.permiteMultiple }
          : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
        ...(dto.opciones
          ? {
              opciones_modificadores: {
                deleteMany: {},
                create: dto.opciones.map((opcion) => ({
                  nombre: opcion.nombre.trim(),
                  precio_extra: opcion.precioExtra ?? 0,
                })),
              },
            }
          : {}),
      },
      include: { opciones_modificadores: true },
    });
  }

  async deleteModifierGroup(id: string) {
    await this.requireGroup(id);
    return this.prisma.scoped.grupos_modificadores.update({
      where: { id },
      data: { activo: false },
    });
  }

  private empresaId(): string {
    const context = this.tenantContext.get();
    if (!context?.empresaId) {
      throw new BadRequestException('La operación requiere una empresa en el token');
    }
    return context.empresaId;
  }

  // ─── Guards internos ───────────────────────────────────────────────────────

  private async requireCategory(id: string) {
    const categoria = await this.prisma.scoped.categorias.findFirst({ where: { id } });
    if (!categoria) throw new NotFoundException('Categoría no encontrada');
    return categoria;
  }

  private async requireDish(id: string) {
    const plato = await this.prisma.scoped.platos.findFirst({
      where: { id, deleted_at: null },
    });
    if (!plato) throw new NotFoundException('Plato no encontrado');
    return plato;
  }

  private async requireGroup(id: string) {
    const grupo = await this.prisma.scoped.grupos_modificadores.findFirst({
      where: { id },
    });
    if (!grupo) throw new NotFoundException('Grupo de modificadores no encontrado');
    return grupo;
  }

  private async requireGroups(ids: string[]) {
    if (!ids.length) return;
    const total = await this.prisma.scoped.grupos_modificadores.count({
      where: { id: { in: ids } },
    });
    if (total !== ids.length) {
      throw new NotFoundException('Uno o más grupos de modificadores no existen');
    }
  }
}
