import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TenantContextService } from '../../common/context/tenant-context.service.js';
import { AuditService } from '../audit/audit.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { paginationOf } from '../../common/dto/pagination.dto.js';
import type { metodo_pago } from '../../generated/prisma/enums.js';
import type {
  ChargeOrderDto,
  CloseShiftDto,
  CreateMovementDto,
  ListMovementsQueryDto,
  ListShiftsQueryDto,
} from './dto/cash.dto.js';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

interface MovimientoResumen {
  ingresos: number;
  egresos: number;
  ingresosEfectivo: number;
  egresosEfectivo: number;
  movimientos: number;
}

/**
 * Caja de la sucursal (AYCDS-34).
 *
 * Un turno se abre con fondo, recibe movimientos (ingresos y egresos) y se
 * cierra con arqueo. Todo lo que entra o sale queda en `movimientos_caja`, que
 * es append-only: las correcciones se compensan, no se editan.
 *
 * Los totales del turno se calculan **desde los movimientos** al cerrar; no se
 * llevan denormalizados durante el turno para no tener dos verdades.
 */
@Injectable()
export class CashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly orders: OrdersService,
    private readonly audit: AuditService,
  ) {}

  async current(solicitada?: string) {
    const sucursalId = this.resolveSucursalFiltro(solicitada);
    const turno = await this.prisma.scoped.turnos_caja.findFirst({
      where: { estado: 'ABIERTO', ...(sucursalId ? { sucursal_id: sucursalId } : {}) },
      orderBy: { apertura_at: 'desc' },
      include: { usuarios: { select: { id: true, nombre: true } } },
    });

    if (!turno) return null;
    return { turno, arqueo: await this.arqueoDe(turno.id, Number(turno.fondo_apertura)) };
  }

  async listShifts(query: ListShiftsQueryDto) {
    const { skip, take } = paginationOf(query);
    const sucursalId = this.resolveSucursalFiltro(query.sucursalId);
    const where = {
      ...(sucursalId ? { sucursal_id: sucursalId } : {}),
      ...(query.desde || query.hasta
        ? {
            apertura_at: {
              ...(query.desde ? { gte: new Date(query.desde) } : {}),
              ...(query.hasta ? { lte: new Date(query.hasta) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.scoped.turnos_caja.findMany({
        where,
        skip,
        take,
        orderBy: { apertura_at: 'desc' },
        include: { usuarios: { select: { id: true, nombre: true } } },
      }),
      this.prisma.scoped.turnos_caja.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async open(solicitada: string | undefined, fondoApertura: number) {
    const { empresaId, userId } = this.tenant();
    const sucursalId = await this.resolveSucursal(solicitada);

    const abierto = await this.prisma.scoped.turnos_caja.findFirst({
      where: { estado: 'ABIERTO', sucursal_id: sucursalId },
      select: { id: true },
    });
    if (abierto) {
      throw new ConflictException('Ya hay un turno de caja abierto en esta sucursal');
    }

    let turno;
    try {
      turno = await this.prisma.scoped.turnos_caja.create({
        data: {
          empresa_id: empresaId,
          sucursal_id: sucursalId,
          cajero_id: userId,
          fondo_apertura: fondoApertura,
        },
      });
    } catch (error) {
      // El índice único parcial es la garantía real: dos cajas abriendo a la vez.
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ya hay un turno de caja abierto en esta sucursal');
      }
      throw error;
    }

    await this.audit.record({
      empresaId,
      sucursalId,
      usuarioId: userId,
      accion: 'caja.abierta',
      entidad: 'turnos_caja',
      entidadId: turno.id,
      detalle: { fondo: fondoApertura },
    });

    return { turno, arqueo: await this.arqueoDe(turno.id, fondoApertura) };
  }

  async close(id: string, dto: CloseShiftDto) {
    const { empresaId, userId } = this.tenant();
    const turno = await this.prisma.scoped.turnos_caja.findFirst({ where: { id } });
    if (!turno) throw new NotFoundException('Turno de caja no encontrado');
    if (turno.estado === 'CERRADO') {
      throw new ConflictException('El turno ya está cerrado');
    }

    const fondo = Number(turno.fondo_apertura);
    const arqueo = await this.arqueoDe(turno.id, fondo);
    const diferencia = round2(dto.efectivoContado - arqueo.esperadoEfectivo);

    const { count } = await this.prisma.scoped.turnos_caja.updateMany({
      where: { id, estado: 'ABIERTO' },
      data: {
        estado: 'CERRADO',
        cierre_at: new Date(),
        ingresos_total: arqueo.ingresos,
        egresos_total: arqueo.egresos,
        saldo: arqueo.saldoSistema,
        efectivo_contado: dto.efectivoContado,
        diferencia,
        observaciones: dto.observaciones ?? null,
      },
    });
    if (count === 0) {
      throw new ConflictException('El turno ya estaba cerrado');
    }

    await this.audit.record({
      empresaId,
      sucursalId: turno.sucursal_id,
      usuarioId: userId,
      accion: 'caja.cerrada',
      entidad: 'turnos_caja',
      entidadId: turno.id,
      detalle: {
        fondo,
        ingresos: arqueo.ingresos,
        egresos: arqueo.egresos,
        esperadoEfectivo: arqueo.esperadoEfectivo,
        efectivoContado: dto.efectivoContado,
        diferencia,
        observaciones: dto.observaciones ?? null,
      },
    });

    return {
      turno: await this.prisma.scoped.turnos_caja.findFirstOrThrow({ where: { id } }),
      arqueo: { ...arqueo, efectivoContado: dto.efectivoContado, diferencia },
    };
  }

  async movements(query: ListMovementsQueryDto) {
    const { skip, take } = paginationOf(query);
    const turnoId = query.turnoId ?? (await this.turnoAbiertoODefecto()).id;

    const where = {
      turno_id: turnoId,
      ...(query.tipo ? { tipo: query.tipo } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.scoped.movimientos_caja.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
        include: { usuarios: { select: { id: true, nombre: true } } },
      }),
      this.prisma.scoped.movimientos_caja.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit, turnoId };
  }

  async createMovement(dto: CreateMovementDto) {
    const { empresaId, userId } = this.tenant();
    const turno = await this.turnoAbiertoODefecto(dto.sucursalId);

    const movimiento = await this.prisma.scoped.movimientos_caja.create({
      data: {
        empresa_id: empresaId,
        turno_id: turno.id,
        tipo: dto.tipo,
        concepto: dto.concepto,
        monto: dto.monto,
        metodo: dto.metodo,
        actor_id: userId,
      },
    });

    await this.audit.record({
      empresaId,
      sucursalId: turno.sucursal_id,
      usuarioId: userId,
      accion: `caja.${dto.tipo.toLowerCase()}`,
      entidad: 'movimientos_caja',
      entidadId: movimiento.id,
      detalle: {
        concepto: dto.concepto,
        monto: dto.monto,
        metodo: dto.metodo,
        turnoId: turno.id,
      },
    });

    return movimiento;
  }

  /**
   * Cobra una comanda contra la caja abierta.
   *
   * Admite pagos parciales (varios métodos) y propina; cuando lo cobrado cubre
   * el total, la orden pasa a `PAGADA`, que es lo que libera la mesa y avisa al
   * KDS. La propina se acumula en `ordenes.propina` para el pozo del día.
   */
  async charge(dto: ChargeOrderDto) {
    const { empresaId, userId } = this.tenant();

    const orden = await this.prisma.scoped.ordenes.findFirst({
      where: { id: dto.ordenId },
      select: {
        id: true,
        numero_orden: true,
        estado: true,
        total: true,
        propina: true,
        sucursal_id: true,
      },
    });
    if (!orden) throw new NotFoundException('Orden no encontrada');
    if (orden.estado === 'PAGADA' || orden.estado === 'CERRADA') {
      throw new ConflictException('La orden ya está cobrada');
    }
    if (orden.estado === 'ANULADA') {
      throw new ConflictException('La orden está anulada');
    }
    if (orden.estado !== 'ENTREGADO') {
      throw new ConflictException('Solo se cobra una comanda ENTREGADA');
    }

    const turno = await this.turnoAbierto(orden.sucursal_id);
    const total = Number(orden.total);
    const pendiente = round2(total - (await this.netoDe(orden.id)));
    if (pendiente <= 0) {
      throw new ConflictException('La orden no tiene saldo por cobrar');
    }

    const monto = round2(dto.monto ?? pendiente);
    if (monto > pendiente) {
      throw new BadRequestException(
        `El importe supera el saldo pendiente (${pendiente.toFixed(2)})`,
      );
    }
    const propina = round2(dto.propina ?? 0);

    const cobro = await this.prisma.scoped.movimientos_caja.create({
      data: {
        empresa_id: empresaId,
        turno_id: turno.id,
        tipo: 'INGRESO',
        concepto: `Cobro ${orden.numero_orden}`,
        monto,
        metodo: dto.metodo,
        orden_id: orden.id,
        actor_id: userId,
      },
    });

    if (propina > 0) {
      await this.prisma.scoped.ordenes.updateMany({
        where: { id: orden.id },
        data: { propina: { increment: propina } },
      });
      await this.prisma.scoped.movimientos_caja.create({
        data: {
          empresa_id: empresaId,
          turno_id: turno.id,
          tipo: 'INGRESO',
          concepto: `Propina ${orden.numero_orden}`,
          monto: propina,
          metodo: dto.metodo,
          orden_id: orden.id,
          actor_id: userId,
        },
      });
    }

    const queda = round2(pendiente - monto);
    let pagada = false;
    if (queda <= 0) {
      await this.orders.markPaid(orden.id);
      pagada = true;
    }

    await this.audit.record({
      empresaId,
      sucursalId: orden.sucursal_id,
      usuarioId: userId,
      accion: 'caja.cobro',
      entidad: 'ordenes',
      entidadId: orden.id,
      detalle: {
        numeroOrden: orden.numero_orden,
        monto,
        propina,
        metodo: dto.metodo,
        pendiente: queda,
        pagada,
        turnoId: turno.id,
        movimientoId: cobro.id,
      },
    });

    return {
      ordenId: orden.id,
      numeroOrden: orden.numero_orden,
      turnoId: turno.id,
      cobrado: monto,
      propina,
      total,
      pendiente: queda,
      pagada,
    };
  }

  /**
   * Egreso de caja por el pago de un gasto (AYCDS-17).
   *
   * Vive aquí y no en `ExpensesService` para que el turno abierto y las reglas
   * de `movimientos_caja` se validen en un solo sitio. El movimiento queda
   * ligado al gasto con `gasto_id`, así el arqueo lo muestra y la auditoría lo
   * puede rastrear.
   */
  async egresoDeGasto(
    sucursalId: string,
    input: {
      concepto: string;
      monto: number;
      gastoId: string;
      actorId?: string | null;
    },
  ) {
    const { empresaId, userId } = this.tenant();
    const turno = await this.turnoAbierto(sucursalId);

    const movimiento = await this.prisma.scoped.movimientos_caja.create({
      data: {
        empresa_id: empresaId,
        turno_id: turno.id,
        tipo: 'EGRESO',
        concepto: input.concepto.slice(0, 200),
        monto: input.monto,
        metodo: 'EFECTIVO',
        gasto_id: input.gastoId,
        actor_id: input.actorId ?? userId,
      },
    });

    await this.audit.record({
      empresaId,
      sucursalId,
      usuarioId: input.actorId ?? userId,
      accion: 'caja.egreso',
      entidad: 'movimientos_caja',
      entidadId: movimiento.id,
      detalle: {
        concepto: input.concepto,
        monto: input.monto,
        gastoId: input.gastoId,
        turnoId: turno.id,
      },
    });

    return { movimiento, turno };
  }

  /** Arqueo del turno: totales, esperado en efectivo y diferencia. */
  async arqueoDe(turnoId: string, fondo: number) {
    const movimientos = await this.prisma.scoped.movimientos_caja.findMany({
      where: { turno_id: turnoId },
      select: { tipo: true, metodo: true, monto: true },
    });

    const resumen: MovimientoResumen = {
      ingresos: 0,
      egresos: 0,
      ingresosEfectivo: 0,
      egresosEfectivo: 0,
      movimientos: movimientos.length,
    };

    for (const movimiento of movimientos) {
      const monto = Number(movimiento.monto);
      if (movimiento.tipo === 'INGRESO') {
        resumen.ingresos += monto;
        if (movimiento.metodo === 'EFECTIVO') resumen.ingresosEfectivo += monto;
      } else {
        resumen.egresos += monto;
        if (movimiento.metodo === 'EFECTIVO') resumen.egresosEfectivo += monto;
      }
    }

    const ingresos = round2(resumen.ingresos);
    const egresos = round2(resumen.egresos);
    const ingresosEfectivo = round2(resumen.ingresosEfectivo);
    const egresosEfectivo = round2(resumen.egresosEfectivo);

    return {
      fondo: round2(fondo),
      ingresos,
      egresos,
      ingresosEfectivo,
      egresosEfectivo,
      esperadoEfectivo: round2(fondo + ingresosEfectivo - egresosEfectivo),
      saldoSistema: round2(fondo + ingresos - egresos),
      movimientos: resumen.movimientos,
      efectivoContado: null as number | null,
      diferencia: null as number | null,
    };
  }

  private async netoDe(ordenId: string): Promise<number> {
    const movimientos = await this.prisma.scoped.movimientos_caja.findMany({
      where: { orden_id: ordenId },
      select: { tipo: true, monto: true },
    });

    let neto = 0;
    for (const movimiento of movimientos) {
      const monto = Number(movimiento.monto);
      neto += movimiento.tipo === 'INGRESO' ? monto : -monto;
    }
    return round2(neto);
  }

  private async turnoAbiertoODefecto(solicitada?: string) {
    const sucursalId = this.resolveSucursalFiltro(solicitada);
    if (!sucursalId) {
      throw new BadRequestException(
        'Indica sucursalId: tu usuario no está atado a una sucursal',
      );
    }
    const turno = await this.turnoAbierto(sucursalId);
    return turno;
  }

  private async turnoAbierto(sucursalId: string) {
    const turno = await this.prisma.scoped.turnos_caja.findFirst({
      where: { estado: 'ABIERTO', sucursal_id: sucursalId },
      select: { id: true, sucursal_id: true },
      orderBy: { apertura_at: 'desc' },
    });
    if (!turno) {
      throw new ConflictException(
        'No hay turno de caja abierto: abre caja antes de operar',
      );
    }
    return turno;
  }

  private tenant(): { empresaId: string; userId: string | null } {
    const context = this.tenantContext.get();
    if (!context?.empresaId) {
      throw new BadRequestException('La operación requiere empresa en el token');
    }
    return { empresaId: context.empresaId, userId: context.userId ?? null };
  }

  private resolveSucursalFiltro(solicitada?: string): string | null {
    const delToken = this.tenantContext.get()?.sucursalId ?? null;
    if (delToken) {
      if (solicitada && solicitada !== delToken) {
        throw new BadRequestException(
          'El token está atado a otra sucursal: no se puede indicar sucursalId',
        );
      }
      return delToken;
    }
    return solicitada ?? null;
  }

  private async resolveSucursal(solicitada?: string): Promise<string> {
    const delToken = this.tenantContext.get()?.sucursalId ?? null;
    if (delToken) {
      if (solicitada && solicitada !== delToken) {
        throw new BadRequestException(
          'El token está atado a otra sucursal: no se puede indicar sucursalId',
        );
      }
      return delToken;
    }
    if (!solicitada) {
      throw new BadRequestException(
        'Indica sucursalId: tu usuario no está atado a una sucursal',
      );
    }
    const sucursal = await this.prisma.scoped.sucursales.findFirst({
      where: { id: solicitada, deleted_at: null },
      select: { id: true },
    });
    if (!sucursal) throw new NotFoundException('Sucursal no encontrada');
    return sucursal.id;
  }

  /** Métodos válidos, para mensajes de error claros en la UI. */
  static readonly metodos: metodo_pago[] = [
    'EFECTIVO',
    'TARJETA',
    'YAPE',
    'TRANSFERENCIA',
  ];
}
