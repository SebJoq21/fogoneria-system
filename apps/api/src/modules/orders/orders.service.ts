import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TenantContextService } from '../../common/context/tenant-context.service.js';
import { SequencesService } from '../../common/sequences/sequences.service.js';
import { AuditService } from '../audit/audit.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { paginationOf } from '../../common/dto/pagination.dto.js';
import {
  ACTIVE_RESERVATION_STATES,
  OPEN_ORDER_STATES,
} from '../../common/constants/estados.js';
import type { estado_orden, origen_orden } from '../../generated/prisma/enums.js';
import type { CreateOrderDto, OrderItemDto } from './dto/create-order.dto.js';
import type { ListOrdersQueryDto } from './dto/list-orders.dto.js';

/**
 * Transiciones del KDS (AYCDS-20).
 *
 * `ANULADA` solo sale de `POR_CONFIRMAR`: una orden ya en preparación o lista
 * no se deshace, se entrega y se compensa. El trigger `trg_ordenes_inmutable`
 * aplica la misma regla en la base.
 */
const TRANSITIONS: Record<estado_orden, readonly estado_orden[]> = {
  POR_CONFIRMAR: ['EN_COCINA', 'ANULADA'],
  EN_COCINA: ['LISTO'],
  LISTO: ['ENTREGADO'],
  ENTREGADO: ['PAGADA', 'CERRADA'],
  PAGADA: [],
  CERRADA: [],
  ANULADA: [],
};

/** Estados sin retorno: no admiten más cambios ni edición de líneas. */
const TERMINAL: readonly estado_orden[] = ['PAGADA', 'CERRADA', 'ANULADA'];

/** Los importes se guardan con 2 decimales; el cálculo del servidor los respeta. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly sequences: SequencesService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
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

  /**
   * Captura una comanda (AYCDS-20).
   *
   * El precio lo pone el servidor (`PricingService.resolvePrice` para platos y
   * `combos.precio_fijo` para combos): el body ya no acepta `precioUnitario`,
   * así que un cliente no puede inyectar importes. El número de orden sale de
   * una secuencia por empresa y el `mesero_id` del JWT, no del body.
   */
  async create(dto: CreateOrderDto) {
    const { empresaId, userId } = this.tenant();
    const mesa = dto.mesaId ? await this.requireMesa(dto.mesaId) : null;
    const sucursalId = await this.resolveSucursal(dto.sucursalId, mesa?.sucursal_id);

    if (mesa && mesa.sucursal_id !== sucursalId) {
      throw new BadRequestException('La mesa pertenece a otra sucursal');
    }
    if (mesa?.estado === 'MANTENIMIENTO') {
      throw new ConflictException('La mesa está en mantenimiento');
    }

    const listaId = await this.resolveList(dto.listaPrecioId);
    const items = await this.priceItems(dto.items, listaId);

    const subtotal = round2(
      items.reduce((sum, item) => sum + item.subtotal, 0),
    );
    const descuento = round2(dto.descuento ?? 0);
    if (descuento > subtotal) {
      throw new BadRequestException('El descuento no puede superar el subtotal');
    }

    const numeroOrden = await this.sequences.nextNumeroOrden(empresaId);
    const origen: origen_orden = dto.origen ?? (mesa ? 'MESA' : 'BARRA');

    const orden = await this.prisma.scoped.ordenes.create({
      data: {
        numero_orden: numeroOrden,
        empresa_id: empresaId,
        sucursal_id: sucursalId,
        mesa_id: mesa?.id ?? null,
        cliente_id: dto.clienteId ?? null,
        mesero_id: userId,
        origen,
        lista_precio_id: listaId,
        subtotal,
        descuento_cupon: descuento,
        total: round2(subtotal - descuento),
        detalles_orden: { create: items },
      },
      include: { detalles_orden: true },
    });

    if (mesa) {
      await this.prisma.scoped.mesas.updateMany({
        where: { id: mesa.id },
        data: { estado: 'OCUPADA' },
      });
    }

    await this.audit.record({
      empresaId,
      sucursalId,
      usuarioId: userId,
      accion: 'orden.creada',
      entidad: 'ordenes',
      entidadId: orden.id,
      detalle: {
        numeroOrden,
        mesaId: mesa?.id ?? null,
        lineas: items.length,
        total: Number(orden.total),
      },
    });

    // Aviso a cocina y mesero (AYCDS-14). Se emite después de escribir: si el
    // evento se perdiera, el cliente lo recupera al reconectar (refresco HTTP).
    if (sucursalId) {
      this.realtime.orderCreated(empresaId, {
        ordenId: orden.id,
        numeroOrden,
        estado: 'POR_CONFIRMAR',
        origen,
        sucursalId,
        mesaId: mesa?.id ?? null,
        total: Number(orden.total),
        creadaAt: (orden.created_at ?? new Date()).toISOString(),
      });
      if (mesa) {
        this.realtime.tableStatus(empresaId, {
          mesaId: mesa.id,
          numero: mesa.numero ?? null,
          de: mesa.estado,
          a: 'OCUPADA',
          sucursalId,
        });
      }
    }

    return orden;
  }

  async updateStatus(id: string, estado: estado_orden) {
    const orden = await this.prisma.scoped.ordenes.findFirst({
      where: { id },
      select: {
        id: true,
        numero_orden: true,
        estado: true,
        mesa_id: true,
        sucursal_id: true,
        mesas: { select: { numero: true } },
      },
    });
    if (!orden) throw new NotFoundException('Orden no encontrada');

    if (TERMINAL.includes(orden.estado)) {
      throw new ConflictException(
        `La orden ${orden.numero_orden} está ${orden.estado}: es un estado terminal`,
      );
    }

    const allowed = TRANSITIONS[orden.estado] ?? [];
    if (!allowed.includes(estado)) {
      const detalle =
        estado === 'ANULADA'
          ? `: una orden ${orden.estado} ya no se anula`
          : '';
      throw new BadRequestException(
        `Transición inválida: ${orden.estado} → ${estado}${detalle}`,
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

    const liberada =
      TERMINAL.includes(estado) ? await this.releaseTable(orden.mesa_id) : null;

    await this.audit.record({
      empresaId: this.tenant().empresaId,
      sucursalId: orden.sucursal_id,
      usuarioId: this.tenantContext.get()?.userId ?? null,
      accion: estado === 'ANULADA' ? 'orden.anulada' : 'orden.estado',
      entidad: 'ordenes',
      entidadId: orden.id,
      detalle: {
        numeroOrden: orden.numero_orden,
        de: orden.estado,
        a: estado,
      },
    });

    // Aviso en vivo al KDS/mesero (AYCDS-14).
    const empresaId = this.tenant().empresaId;
    this.realtime.orderUpdated(empresaId, {
      ordenId: orden.id,
      numeroOrden: orden.numero_orden,
      de: orden.estado,
      a: estado,
      sucursalId: orden.sucursal_id,
      mesaId: orden.mesa_id,
    });
    if (liberada && orden.mesa_id) {
      this.realtime.tableStatus(empresaId, {
        mesaId: orden.mesa_id,
        numero: orden.mesas?.numero ?? null,
        de: 'OCUPADA',
        a: liberada,
        sucursalId: orden.sucursal_id,
      });
    }

    return this.findOne(id);
  }

  /**
   * Precio del servidor para toda la comanda. Ignora cualquier importe que
   * llegue del cliente.
   *
   * Antes se resolvía línea por línea (1 consulta de plato + 1 de precio por
   * ítem). En el pico de comandas eso era un N+1 que la base no justificaba
   * (AYCDS-22): ahora se traen todos los platos, combos y precios en tres
   * consultas, sin importar cuántas líneas tenga la orden.
   */
  private async priceItems(
    items: OrderItemDto[],
    listaId: string | null,
  ) {
    for (const item of items) {
      if (item.tipo === 'PLATO' && !item.platoId) {
        throw new BadRequestException('Un ítem PLATO requiere platoId');
      }
      if (item.tipo === 'COMBO' && !item.comboId) {
        throw new BadRequestException('Un ítem COMBO requiere comboId');
      }
    }

    const platoIds = [
      ...new Set(
        items
          .filter((item) => item.tipo === 'PLATO')
          .map((item) => item.platoId as string),
      ),
    ];
    const comboIds = [
      ...new Set(
        items
          .filter((item) => item.tipo === 'COMBO')
          .map((item) => item.comboId as string),
      ),
    ];

    // Van en serie a propósito: comparten la conexión de la transacción del
    // request, así que `Promise.all` solo intercalaría queries en el mismo
    // cliente pg sin ganar paralelismo.
    const platos =
      platoIds.length > 0
        ? await this.prisma.scoped.platos.findMany({
            where: { id: { in: platoIds }, deleted_at: null },
            select: { id: true, nombre: true, activo: true },
          })
        : [];
    const combos =
      comboIds.length > 0
        ? await this.prisma.scoped.combos.findMany({
            where: { id: { in: comboIds }, deleted_at: null },
            select: { id: true, nombre: true, activo: true, precio_fijo: true },
          })
        : [];

    const platoPorId = new Map(platos.map((plato) => [plato.id, plato]));
    const comboPorId = new Map(combos.map((combo) => [combo.id, combo]));

    if (platoIds.length > 0 && !listaId) {
      throw new BadRequestException(
        'No hay lista de precios activa: indica listaPrecioId',
      );
    }

    const precios =
      listaId && platoIds.length > 0
        ? await this.prisma.scoped.precios_platos.findMany({
            where: { lista_id: listaId, plato_id: { in: platoIds } },
            select: { plato_id: true, precio: true },
          })
        : [];
    const precioPorPlato = new Map(
      precios.map((precio) => [precio.plato_id, Number(precio.precio)]),
    );

    return items.map((item) => {
      if (item.tipo === 'PLATO') {
        const plato = platoPorId.get(item.platoId as string);
        if (!plato) throw new NotFoundException('Plato no encontrado');
        if (!plato.activo) {
          throw new BadRequestException(`El plato ${plato.nombre} está inactivo`);
        }

        const precio = precioPorPlato.get(plato.id);
        if (precio === undefined) {
          throw new BadRequestException(
            `El plato ${plato.nombre} no tiene precio en la lista`,
          );
        }

        return {
          tipo: item.tipo,
          plato_id: plato.id,
          combo_id: null,
          cantidad: item.cantidad,
          precio_unitario: precio,
          subtotal: round2(item.cantidad * precio),
          notas: item.notas ?? null,
        };
      }

      const combo = comboPorId.get(item.comboId as string);
      if (!combo) throw new NotFoundException('Combo no encontrado');
      if (!combo.activo) {
        throw new BadRequestException(`El combo ${combo.nombre} está inactivo`);
      }

      const precio = round2(Number(combo.precio_fijo));
      return {
        tipo: item.tipo,
        plato_id: null,
        combo_id: combo.id,
        cantidad: item.cantidad,
        precio_unitario: precio,
        subtotal: round2(item.cantidad * precio),
        notas: item.notas ?? null,
      };
    });
  }

  /**
   * Libera la mesa al cerrar la última orden abierta. Si queda una reserva
   * activa vuelve a `RESERVADA`; nunca pisa `MANTENIMIENTO`.
   *
   * Devuelve el estado nuevo (o `null` si la mesa sigue con órdenes abiertas)
   * para que el llamador pueda emitir `table.status`.
   */
  private async releaseTable(
    mesaId: string | null,
  ): Promise<'LIBRE' | 'RESERVADA' | null> {
    if (!mesaId) return null;

    const [abiertas, reservas] = await Promise.all([
      this.prisma.scoped.ordenes.count({
        where: {
          mesa_id: mesaId,
          estado: { in: [...OPEN_ORDER_STATES] },
        },
      }),
      this.prisma.scoped.reservas.count({
        where: {
          mesa_id: mesaId,
          estado: { in: [...ACTIVE_RESERVATION_STATES] },
        },
      }),
    ]);

    if (abiertas > 0) return null;

    const destino: 'LIBRE' | 'RESERVADA' = reservas > 0 ? 'RESERVADA' : 'LIBRE';
    const result = await this.prisma.scoped.mesas.updateMany({
      where: { id: mesaId, estado: 'OCUPADA' },
      data: { estado: destino },
    });

    return (result?.count ?? 0) > 0 ? destino : null;
  }

  private async requireMesa(id: string) {
    const mesa = await this.prisma.scoped.mesas.findFirst({
      where: { id, deleted_at: null },
      select: { id: true, numero: true, sucursal_id: true, estado: true },
    });
    if (!mesa) throw new NotFoundException('Mesa no encontrada');
    return mesa;
  }

  private async resolveList(solicitada?: string): Promise<string | null> {
    if (solicitada) {
      const lista = await this.prisma.scoped.listas_precios.findFirst({
        where: { id: solicitada, deleted_at: null },
        select: { id: true },
      });
      if (!lista) throw new NotFoundException('Lista de precios no encontrada');
      return lista.id;
    }

    const activa = await this.prisma.scoped.listas_precios.findFirst({
      where: { activa: true, deleted_at: null },
      select: { id: true },
    });
    return activa?.id ?? null;
  }

  /**
   * Los roles operativos llevan la sucursal en el JWT; `ADMIN_GLOBAL` no, así
   * que la orden la toma de la mesa (o de `sucursalId` en el body) y se valida
   * contra su empresa.
   */
  private async resolveSucursal(
    solicitada?: string,
    deMesa?: string,
  ): Promise<string> {
    const delToken = this.tenantContext.get()?.sucursalId ?? null;
    if (delToken) {
      if (solicitada && solicitada !== delToken) {
        throw new BadRequestException(
          'El token está atado a otra sucursal: no se puede indicar sucursalId',
        );
      }
      return delToken;
    }

    if (deMesa && solicitada && solicitada !== deMesa) {
      throw new BadRequestException('La mesa pertenece a otra sucursal');
    }
    // La mesa ya está filtrada por empresa y sucursal vía RLS: no hace falta
    // una consulta extra para resolver su sucursal.
    if (deMesa) return deMesa;

    if (!solicitada) {
      throw new BadRequestException(
        'Indica la mesa o la sucursal de la orden',
      );
    }

    const sucursal = await this.prisma.scoped.sucursales.findFirst({
      where: { id: solicitada, deleted_at: null },
      select: { id: true },
    });
    if (!sucursal) throw new NotFoundException('Sucursal no encontrada');
    return sucursal.id;
  }

  private tenant(): { empresaId: string; userId: string | null } {
    const context = this.tenantContext.get();
    if (!context?.empresaId) {
      throw new BadRequestException('La operación requiere empresa en el token');
    }
    return { empresaId: context.empresaId, userId: context.userId ?? null };
  }
}
