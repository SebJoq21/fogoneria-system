import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TenantContextService } from '../../common/context/tenant-context.service.js';
import { paginationOf } from '../../common/dto/pagination.dto.js';
import type { estado_orden } from '../../generated/prisma/enums.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';
import type { ListOrdersQueryDto } from './dto/list-orders.dto.js';

const TRANSITIONS: Record<string, string[]> = {
  POR_CONFIRMAR: ['EN_COCINA', 'ANULADA'],
  EN_COCINA: ['LISTO', 'ANULADA'],
  LISTO: ['ENTREGADO', 'ANULADA'],
  ENTREGADO: ['PAGADA', 'CERRADA'],
  PAGADA: [],
  CERRADA: [],
  ANULADA: [],
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async list(query: ListOrdersQueryDto) {
    const { skip, take } = paginationOf(query);
    const where = {
      ...(query.estado ? { estado: query.estado } : {}),
      ...(query.sucursalId ? { sucursal_id: query.sucursalId } : {}),
      ...(query.mesaId ? { mesa_id: query.mesaId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.scoped.ordenes.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
        include: {
          detalles_orden: { include: { detalles_orden_modificadores: true } },
          mesas: { select: { id: true, numero: true, zona: true } },
          usuarios: { select: { id: true, nombre: true } },
        },
      }),
      this.prisma.scoped.ordenes.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async findOne(id: string) {
    const orden = await this.prisma.scoped.ordenes.findFirst({
      where: { id },
      include: {
        detalles_orden: { include: { detalles_orden_modificadores: true } },
        mesas: { select: { id: true, numero: true, zona: true } },
        usuarios: { select: { id: true, nombre: true } },
        comprobantes: true,
      },
    });
    if (!orden) throw new NotFoundException('Orden no encontrada');
    return orden;
  }

  async create(dto: CreateOrderDto) {
    const subtotal = dto.items.reduce(
      (sum, item) => sum + item.cantidad * item.precioUnitario,
      0,
    );
    const descuento = dto.descuento ?? 0;
    if (descuento > subtotal) {
      throw new BadRequestException('El descuento no puede superar el subtotal');
    }

    return this.prisma.scoped.ordenes.create({
      data: {
        numero_orden: `ORD-${Date.now()}`,
        empresa_id: this.tenant().empresaId,
        sucursal_id: this.tenant().sucursalId,
        mesa_id: dto.mesaId ?? null,
        cliente_id: dto.clienteId ?? null,
        origen: dto.origen ?? 'MESA',
        lista_precio_id: dto.listaPrecioId ?? null,
        subtotal,
        descuento_cupon: descuento,
        total: subtotal - descuento,
        detalles_orden: {
          create: dto.items.map((item) => ({
            tipo: item.tipo,
            plato_id: item.platoId ?? null,
            combo_id: item.comboId ?? null,
            cantidad: item.cantidad,
            precio_unitario: item.precioUnitario,
            subtotal: item.cantidad * item.precioUnitario,
            notas: item.notas ?? null,
          })),
        },
      },
      include: { detalles_orden: true },
    });
  }

  async updateStatus(id: string, estado: estado_orden) {
    const orden = await this.prisma.scoped.ordenes.findFirst({ where: { id } });
    if (!orden) throw new NotFoundException('Orden no encontrada');

    const allowed = TRANSITIONS[orden.estado] ?? [];
    if (!allowed.includes(estado)) {
      throw new BadRequestException(
        `Transición inválida: ${orden.estado} → ${estado}`,
      );
    }

    const now = new Date();
    const timestamps: Record<string, Date> = {};
    if (estado === 'EN_COCINA') timestamps.confirmacion_at = now;
    if (estado === 'LISTO') timestamps.listo_at = now;
    if (estado === 'ENTREGADO') timestamps.entrega_at = now;

    await this.prisma.scoped.ordenes.updateMany({
      where: { id },
      data: { estado, ...timestamps },
    });

    return this.findOne(id);
  }

  private tenant(): { empresaId: string; sucursalId: string } {
    const context = this.tenantContext.get();
    if (!context?.empresaId || !context.sucursalId) {
      throw new BadRequestException(
        'La operación requiere empresa y sucursal en el token',
      );
    }
    return { empresaId: context.empresaId, sucursalId: context.sucursalId };
  }
}
