import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TenantContextService } from '../../common/context/tenant-context.service.js';
import type {
  CreatePriceListDto,
  PriceItemDto,
  UpdatePriceListDto,
} from './dto/price-list.dto.js';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  list() {
    return this.prisma.scoped.listas_precios.findMany({
      orderBy: [{ activa: 'desc' }, { nombre: 'asc' }],
      include: { _count: { select: { precios_platos: true } } },
    });
  }

  async create(dto: CreatePriceListDto) {
    this.validateWindow(dto.vigenciaDesde, dto.vigenciaHasta);
    try {
      return await this.prisma.scoped.listas_precios.create({
        data: {
          empresa_id: this.empresaId(),
          nombre: dto.nombre.trim(),
          activa: dto.activa ?? false,
          vigencia_desde: dto.vigenciaDesde ? new Date(dto.vigenciaDesde) : null,
          vigencia_hasta: dto.vigenciaHasta ? new Date(dto.vigenciaHasta) : null,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ya existe una lista con ese nombre');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdatePriceListDto) {
    await this.requireList(id);
    this.validateWindow(dto.vigenciaDesde, dto.vigenciaHasta);
    try {
      return await this.prisma.scoped.listas_precios.update({
        where: { id },
        data: {
          ...(dto.nombre !== undefined ? { nombre: dto.nombre.trim() } : {}),
          ...(dto.activa !== undefined ? { activa: dto.activa } : {}),
          ...(dto.vigenciaDesde !== undefined
            ? { vigencia_desde: new Date(dto.vigenciaDesde) }
            : {}),
          ...(dto.vigenciaHasta !== undefined
            ? { vigencia_hasta: new Date(dto.vigenciaHasta) }
            : {}),
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ya existe una lista con ese nombre');
      }
      throw error;
    }
  }

  async deactivate(id: string) {
    await this.requireList(id);
    return this.prisma.scoped.listas_precios.update({
      where: { id },
      data: { activa: false },
    });
  }

  async activate(id: string) {
    await this.requireList(id);
    const [, lista] = await this.prisma.scoped.$transaction([
      this.prisma.scoped.listas_precios.updateMany({
        data: { activa: false },
      }),
      this.prisma.scoped.listas_precios.update({
        where: { id },
        data: { activa: true },
      }),
    ]);
    return lista;
  }

  async getPrices(listId: string) {
    await this.requireList(listId);
    return this.prisma.scoped.precios_platos.findMany({
      where: { lista_id: listId },
      include: {
        platos: { select: { id: true, nombre: true, sku: true, activo: true } },
      },
      orderBy: { platos: { nombre: 'asc' } },
    });
  }

  async setPrices(listId: string, items: PriceItemDto[]) {
    await this.requireList(listId);
    await this.requireDishes(items.map((item) => item.platoId));

    return this.prisma.scoped.$transaction(
      items.map((item) =>
        this.prisma.scoped.precios_platos.upsert({
          where: {
            lista_id_plato_id: { lista_id: listId, plato_id: item.platoId },
          },
          create: {
            lista_id: listId,
            plato_id: item.platoId,
            precio: item.precio,
          },
          update: { precio: item.precio },
        }),
      ),
    );
  }

  async resolvePrice(platoId: string, listId?: string) {
    let targetList = listId;
    if (!targetList) {
      const active = await this.prisma.scoped.listas_precios.findFirst({
        where: { activa: true },
        select: { id: true },
      });
      targetList = active?.id;
    }
    if (!targetList) return { platoId, listaId: null, precio: null };

    const price = await this.prisma.scoped.precios_platos.findFirst({
      where: { lista_id: targetList, plato_id: platoId },
    });
    return {
      platoId,
      listaId: targetList,
      precio: price ? Number(price.precio) : null,
    };
  }

  private empresaId(): string {
    const context = this.tenantContext.get();
    if (!context?.empresaId) {
      throw new BadRequestException('La operación requiere una empresa en el token');
    }
    return context.empresaId;
  }

  private async requireList(id: string) {
    const lista = await this.prisma.scoped.listas_precios.findFirst({ where: { id } });
    if (!lista) throw new NotFoundException('Lista de precios no encontrada');
    return lista;
  }

  private async requireDishes(ids: string[]) {
    const unique = [...new Set(ids)];
    const total = await this.prisma.scoped.platos.count({
      where: { id: { in: unique }, deleted_at: null },
    });
    if (total !== unique.length) {
      throw new NotFoundException('Uno o más platos no existen');
    }
  }

  private validateWindow(from?: string, to?: string) {
    if (from && to && new Date(from) > new Date(to)) {
      throw new BadRequestException('La vigencia inicial no puede ser posterior a la final');
    }
  }
}
