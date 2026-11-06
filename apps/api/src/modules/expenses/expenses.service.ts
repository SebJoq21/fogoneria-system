import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TenantContextService } from '../../common/context/tenant-context.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CashService } from '../cash/cash.service.js';
import { paginationOf } from '../../common/dto/pagination.dto.js';
import { limaDayRange } from '../../common/utils/lima-day.js';
import type { metodo_pago } from '../../generated/prisma/enums.js';
import type {
  CreateExpenseDto,
  ListExpensesQueryDto,
  UpdateExpenseDto,
} from './dto/expenses.dto.js';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Gastos y cuentas por pagar (AYCDS-17).
 *
 * La regla de oro: **un gasto pagado en efectivo sale de la caja**. Si el pago
 * es por banco o billetera, el gasto se marca `PAGADO` pero no toca el turno
 * (el banco no está en el cajón). Un gasto ya pagado en caja no se edita: la
 * base lo bloquea (`DB_GASTO_PAGADO`) y aquí se devuelve 409 con el motivo.
 *
 * No hay borrado: la contabilidad no se elimina. Un gasto mal creado se
 * compensa con otro movimiento, igual que en el resto del sistema.
 */
@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly cash: CashService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListExpensesQueryDto) {
    const { skip, take } = paginationOf(query);
    const sucursalId = this.resolveSucursalFiltro(query.sucursalId);
    const hoy = limaDayRange(new Date().toISOString().slice(0, 10));

    const where = {
      ...(sucursalId ? { sucursal_id: sucursalId } : {}),
      ...(query.estadoPago ? { estado_pago: query.estadoPago } : {}),
      ...(query.categoria ? { categoria: query.categoria } : {}),
      ...(query.vencidos
        ? {
            estado_pago: 'PENDIENTE' as const,
            vencimiento: { lt: hoy?.start ?? new Date() },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.scoped.gastos.findMany({
        where,
        skip,
        take,
        orderBy: [{ estado_pago: 'asc' }, { vencimiento: 'asc' }, { created_at: 'desc' }],
        include: {
          proveedores: { select: { id: true, nombre: true } },
          usuarios: { select: { id: true, nombre: true } },
        },
      }),
      this.prisma.scoped.gastos.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  /** Cuánto falta pagar, cuánto está vencido y cuánto se pagó este mes. */
  async summary(query: ListExpensesQueryDto) {
    const sucursalId = this.resolveSucursalFiltro(query.sucursalId);
    const base = sucursalId ? { sucursal_id: sucursalId } : {};
    const hoy = limaDayRange(new Date().toISOString().slice(0, 10));
    const inicioMes = `${new Date().toISOString().slice(0, 7)}-01`;

    const [pendientes, vencidos, pagadosMes] = await Promise.all([
      this.prisma.scoped.gastos.aggregate({
        where: { ...base, estado_pago: 'PENDIENTE' },
        _sum: { monto: true },
        _count: { _all: true },
      }),
      this.prisma.scoped.gastos.aggregate({
        where: {
          ...base,
          estado_pago: 'PENDIENTE',
          vencimiento: { lt: hoy?.start ?? new Date() },
        },
        _sum: { monto: true },
        _count: { _all: true },
      }),
      this.prisma.scoped.gastos.aggregate({
        where: {
          ...base,
          estado_pago: 'PAGADO',
          updated_at: { gte: new Date(`${inicioMes}T00:00:00-05:00`) },
        },
        _sum: { monto: true },
        _count: { _all: true },
      }),
    ]);

    return {
      porPagar: round2(Number(pendientes._sum.monto ?? 0)),
      porPagarCantidad: pendientes._count._all,
      vencido: round2(Number(vencidos._sum.monto ?? 0)),
      vencidoCantidad: vencidos._count._all,
      pagadoMes: round2(Number(pagadosMes._sum.monto ?? 0)),
      pagadoMesCantidad: pagadosMes._count._all,
    };
  }

  async create(dto: CreateExpenseDto) {
    const { empresaId, userId } = this.tenant();
    const sucursalId = await this.resolveSucursal(dto.sucursalId);

    if (dto.proveedorId) await this.requireProveedor(dto.proveedorId);

    const gasto = await this.prisma.scoped.gastos.create({
      data: {
        empresa_id: empresaId,
        sucursal_id: sucursalId,
        concepto: dto.concepto.trim(),
        monto: round2(dto.monto),
        categoria: dto.categoria,
        proveedor_id: dto.proveedorId ?? null,
        vencimiento: dto.vencimiento
          ? new Date(`${dto.vencimiento}T00:00:00-05:00`)
          : null,
        registrado_por: userId,
      },
      include: { proveedores: { select: { id: true, nombre: true } } },
    });

    await this.audit.record({
      empresaId,
      sucursalId,
      usuarioId: userId,
      accion: 'gasto.creado',
      entidad: 'gastos',
      entidadId: gasto.id,
      detalle: {
        concepto: gasto.concepto,
        monto: Number(gasto.monto),
        categoria: gasto.categoria,
        vencimiento: dto.vencimiento ?? null,
      },
    });

    return gasto;
  }

  async update(id: string, dto: UpdateExpenseDto) {
    const { empresaId, userId } = this.tenant();
    const gasto = await this.prisma.scoped.gastos.findFirst({ where: { id } });
    if (!gasto) throw new NotFoundException('Gasto no encontrado');
    if (gasto.pagado_en_caja) {
      throw new ConflictException(
        'El gasto ya se pagó en caja: no se puede editar (se compensa con otro movimiento)',
      );
    }
    if (dto.proveedorId) await this.requireProveedor(dto.proveedorId);

    const actualizado = await this.prisma.scoped.gastos.update({
      where: { id },
      data: {
        ...(dto.concepto ? { concepto: dto.concepto.trim() } : {}),
        ...(dto.monto !== undefined ? { monto: round2(dto.monto) } : {}),
        ...(dto.categoria ? { categoria: dto.categoria } : {}),
        ...(dto.proveedorId !== undefined ? { proveedor_id: dto.proveedorId } : {}),
        ...(dto.vencimiento
          ? { vencimiento: new Date(`${dto.vencimiento}T00:00:00-05:00`) }
          : {}),
      },
    });

    await this.audit.record({
      empresaId,
      sucursalId: gasto.sucursal_id,
      usuarioId: userId,
      accion: 'gasto.actualizado',
      entidad: 'gastos',
      entidadId: id,
      detalle: { concepto: actualizado.concepto, monto: Number(actualizado.monto) },
    });

    return actualizado;
  }

  /**
   * Paga el gasto. En efectivo exige turno abierto y deja el egreso en caja con
   * `gasto_id`; con otro método solo cambia el estado.
   *
   * La doble ejecución responde 409: primero se lee el estado y luego el
   * `updateMany` condicional confirma que sigue pendiente.
   */
  async pay(id: string, metodo: metodo_pago) {
    const { empresaId, userId } = this.tenant();
    const gasto = await this.prisma.scoped.gastos.findFirst({
      where: { id },
      select: {
        id: true,
        concepto: true,
        monto: true,
        estado_pago: true,
        pagado_en_caja: true,
        sucursal_id: true,
      },
    });
    if (!gasto) throw new NotFoundException('Gasto no encontrado');
    if (gasto.estado_pago === 'PAGADO') {
      throw new ConflictException('El gasto ya está pagado');
    }

    const monto = round2(Number(gasto.monto));
    const enEfectivo = metodo === 'EFECTIVO';
    let turnoId: string | null = null;

    if (enEfectivo) {
      const { turno } = await this.cash.egresoDeGasto(gasto.sucursal_id, {
        concepto: `Pago de gasto: ${gasto.concepto}`,
        monto,
        gastoId: gasto.id,
        actorId: userId,
      });
      turnoId = turno.id;
    }

    const { count } = await this.prisma.scoped.gastos.updateMany({
      where: { id, estado_pago: 'PENDIENTE' },
      data: {
        estado_pago: 'PAGADO',
        pagado_en_caja: enEfectivo,
        ...(turnoId ? { turno_id: turnoId } : {}),
      },
    });
    if (count === 0) {
      throw new ConflictException('El gasto ya estaba pagado');
    }

    await this.audit.record({
      empresaId,
      sucursalId: gasto.sucursal_id,
      usuarioId: userId,
      accion: 'gasto.pagado',
      entidad: 'gastos',
      entidadId: id,
      detalle: { monto, metodo, turnoId, pagadoEnCaja: enEfectivo },
    });

    return this.prisma.scoped.gastos.findFirst({ where: { id } });
  }

  private async requireProveedor(proveedorId: string): Promise<void> {
    const proveedor = await this.prisma.scoped.proveedores.findFirst({
      where: { id: proveedorId, deleted_at: null },
      select: { id: true },
    });
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');
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

  private tenant(): { empresaId: string; userId: string | null } {
    const context = this.tenantContext.get();
    if (!context?.empresaId) {
      throw new BadRequestException('La operación requiere empresa en el token');
    }
    return { empresaId: context.empresaId, userId: context.userId ?? null };
  }
}
