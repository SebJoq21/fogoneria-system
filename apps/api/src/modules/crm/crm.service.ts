import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TenantContextService } from '../../common/context/tenant-context.service.js';
import { AuditService } from '../audit/audit.service.js';
import { paginationOf } from '../../common/dto/pagination.dto.js';
import {
  CONFIG_POR_DEFECTO,
  deltaPuntos,
  puntosPorConsumo,
  segmentoPorVisitas,
  type ConfigLealtad,
} from './crm.rules.js';
import type {
  AdjustPointsDto,
  CreateCustomerDto,
  ListCustomersQueryDto,
  ListPointsQueryDto,
  UpdateCustomerDto,
  UpdateLoyaltyConfigDto,
} from './dto/crm.dto.js';

/** Delegados que necesita el CRM; sirve para `scoped` (request) y `raw` (worker). */
type DbClient = {
  clientes: {
    findFirst: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
    count: (args: unknown) => Promise<number>;
    create: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
  };
  movimientos_puntos: {
    findMany: (args: unknown) => Promise<unknown[]>;
    create: (args: unknown) => Promise<unknown>;
  };
  ordenes: {
    findMany: (args: unknown) => Promise<unknown[]>;
    count: (args: unknown) => Promise<number>;
  };
};

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

/**
 * CRM: segmentos y puntos de fidelización (AYCDS-31).
 *
 * El segmento (`NUEVO`/`FRECUENTE`/`VIP`) se deriva de las **visitas**, es
 * decir, de las comandas `PAGADA` del cliente: no se guarda un contador que
 * pueda desincronizarse. Los puntos se otorgan por consumo (`total × puntos por
 * sol`) cuando la comanda se paga.
 *
 * El otorgamiento corre en un **worker** y no en el cobro: si el CRM fallara,
 * no debe tumbar una venta. Es idempotente por la existencia de un movimiento
 * `GANANCIA` con la misma orden, y recalcula visitas y puntos desde las fuentes.
 */
@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  /* ------------------------------- clientes ------------------------------ */

  async listCustomers(query: ListCustomersQueryDto) {
    const { skip, take } = paginationOf(query);
    const where = {
      deleted_at: null,
      ...(query.segmento ? { segmento: query.segmento } : {}),
      ...(query.q
        ? {
            OR: [
              { nombre: { contains: query.q, mode: 'insensitive' as const } },
              { telefono: { contains: query.q } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.scoped.clientes.findMany({
        where,
        skip,
        take,
        orderBy: [{ segmento: 'asc' }, { visitas: 'desc' }, { nombre: 'asc' }],
      }),
      this.prisma.scoped.clientes.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async getCustomer(id: string) {
    const cliente = await this.prisma.scoped.clientes.findFirst({
      where: { id, deleted_at: null },
      include: {
        movimientos_puntos: {
          orderBy: { created_at: 'desc' },
          take: 20,
        },
      },
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    return cliente;
  }

  async createCustomer(dto: CreateCustomerDto) {
    const { empresaId, userId } = this.tenant();

    let cliente;
    try {
      cliente = await this.prisma.scoped.clientes.create({
        data: {
          empresa_id: empresaId,
          nombre: dto.nombre.trim(),
          telefono: dto.telefono.trim(),
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ya existe un cliente con ese teléfono');
      }
      throw error;
    }

    await this.audit.record({
      empresaId,
      usuarioId: userId,
      accion: 'cliente.creado',
      entidad: 'clientes',
      entidadId: cliente.id,
      detalle: { nombre: cliente.nombre, telefono: cliente.telefono },
    });

    return cliente;
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto) {
    const { empresaId, userId } = this.tenant();
    const cliente = await this.prisma.scoped.clientes.findFirst({
      where: { id, deleted_at: null },
      select: { id: true },
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');

    let actualizado;
    try {
      actualizado = await this.prisma.scoped.clientes.update({
        where: { id },
        data: {
          ...(dto.nombre ? { nombre: dto.nombre.trim() } : {}),
          ...(dto.telefono ? { telefono: dto.telefono.trim() } : {}),
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ya existe un cliente con ese teléfono');
      }
      throw error;
    }

    await this.audit.record({
      empresaId,
      usuarioId: userId,
      accion: 'cliente.actualizado',
      entidad: 'clientes',
      entidadId: id,
      detalle: { nombre: actualizado.nombre, telefono: actualizado.telefono },
    });

    return actualizado;
  }

  /* -------------------------------- puntos ------------------------------- */

  async listPoints(customerId: string, query: ListPointsQueryDto) {
    const { skip, take } = paginationOf(query);
    const cliente = await this.prisma.scoped.clientes.findFirst({
      where: { id: customerId, deleted_at: null },
      select: { id: true, puntos: true },
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');

    const where = {
      cliente_id: customerId,
      ...(query.tipo ? { tipo: query.tipo } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.scoped.movimientos_puntos.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.scoped.movimientos_puntos.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit, puntos: cliente.puntos };
  }

  /**
   * Ajuste manual de puntos (cortesía, canje o caducidad).
   *
   * El importe se guarda siempre positivo y el signo lo da el tipo; el saldo del
   * cliente se recalcula desde los movimientos para que no se desincronice.
   */
  async adjustPoints(customerId: string, dto: AdjustPointsDto) {
    const { empresaId, userId } = this.tenant();
    const cliente = await this.prisma.scoped.clientes.findFirst({
      where: { id: customerId, deleted_at: null },
      select: { id: true, puntos: true },
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    if (dto.tipo !== 'GANANCIA' && dto.puntos > (cliente.puntos ?? 0)) {
      throw new BadRequestException(
        `El cliente solo tiene ${cliente.puntos} puntos: no se pueden descontar ${dto.puntos}`,
      );
    }

    const sucursalId = await this.resolveSucursal(dto.sucursalId);

    await this.prisma.scoped.movimientos_puntos.create({
      data: {
        cliente_id: customerId,
        empresa_id: empresaId,
        sucursal_id: sucursalId,
        tipo: dto.tipo,
        puntos: dto.puntos,
        motivo: dto.motivo?.trim() || 'Ajuste manual',
      },
    });

    const actualizado = await this.recalcularCliente(customerId);

    await this.audit.record({
      empresaId,
      sucursalId,
      usuarioId: userId,
      accion: 'cliente.puntos',
      entidad: 'clientes',
      entidadId: customerId,
      detalle: { tipo: dto.tipo, puntos: dto.puntos, saldo: actualizado?.puntos ?? null },
    });

    return actualizado;
  }

  /* -------------------------- segmento y config -------------------------- */

  async config(): Promise<ConfigLealtad> {
    const { empresaId } = this.tenant();
    return this.configDe(empresaId);
  }

  async updateConfig(dto: UpdateLoyaltyConfigDto) {
    const { empresaId, userId } = this.tenant();
    const actual = await this.config();
    const umbralFrecuente = dto.umbralFrecuente ?? actual.umbral_frecuente;
    const umbralVip = dto.umbralVip ?? actual.umbral_vip;
    if (umbralVip < umbralFrecuente) {
      throw new BadRequestException(
        'El umbral VIP no puede ser menor que el de frecuente',
      );
    }

    await this.prisma.scoped.config_lealtad.upsert({
      where: { empresa_id: empresaId },
      create: {
        empresa_id: empresaId,
        puntos_por_moneda: dto.puntosPorMoneda ?? actual.puntos_por_moneda,
        caducidad_meses: dto.caducidadMeses ?? actual.caducidad_meses,
        umbral_frecuente: umbralFrecuente,
        umbral_vip: umbralVip,
      },
      update: {
        ...(dto.puntosPorMoneda !== undefined
          ? { puntos_por_moneda: dto.puntosPorMoneda }
          : {}),
        ...(dto.caducidadMeses !== undefined
          ? { caducidad_meses: dto.caducidadMeses }
          : {}),
        ...(dto.umbralFrecuente !== undefined
          ? { umbral_frecuente: dto.umbralFrecuente }
          : {}),
        ...(dto.umbralVip !== undefined ? { umbral_vip: dto.umbralVip } : {}),
      },
    });

    await this.audit.record({
      empresaId,
      usuarioId: userId,
      accion: 'crm.config',
      entidad: 'config_lealtad',
      entidadId: empresaId,
      detalle: { ...dto },
    });

    return this.config();
  }

  /** Recalcula visitas, puntos y segmento de un cliente desde las fuentes. */
  async recalcularCliente(clienteId: string) {
    return this.recalcularCon(this.prisma.scoped as unknown as DbClient, clienteId);
  }

  /**
   * Worker: comandas `PAGADA` de los últimos 7 días con cliente y sin puntos
   * otorgados. Corre fuera de un request, así que usa el cliente de plataforma
   * e itera por empresa (el `empresa_id` sale de cada orden).
   */
  async procesarConsumos(now: Date = new Date()) {
    const desde = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const db = this.prisma.raw as unknown as DbClient;

    const ordenes = (await db.ordenes.findMany({
      where: {
        estado: 'PAGADA',
        cliente_id: { not: null },
        created_at: { gte: desde },
      },
      select: {
        id: true,
        empresa_id: true,
        cliente_id: true,
        sucursal_id: true,
        total: true,
      },
      take: 200,
      orderBy: { created_at: 'asc' },
    })) as {
      id: string;
      empresa_id: string;
      cliente_id: string;
      sucursal_id: string;
      total: unknown;
    }[];

    if (!ordenes.length) return { puntos: 0, clientes: 0 };

    const conPuntos = new Set(
      (
        (await db.movimientos_puntos.findMany({
          where: {
            orden_id: { in: ordenes.map((orden) => orden.id) },
            tipo: 'GANANCIA',
          },
          select: { orden_id: true },
        })) as { orden_id: string | null }[]
      ).map((movimiento) => movimiento.orden_id),
    );

    const pendientes = ordenes.filter((orden) => !conPuntos.has(orden.id));
    if (!pendientes.length) return { puntos: 0, clientes: 0 };

    const configPorEmpresa = new Map<string, ConfigLealtad>();
    let puntosOtorgados = 0;

    for (const orden of pendientes) {
      let config = configPorEmpresa.get(orden.empresa_id);
      if (!config) {
        config = await this.configDe(orden.empresa_id);
        configPorEmpresa.set(orden.empresa_id, config);
      }

      const puntos = puntosPorConsumo(Number(orden.total), config.puntos_por_moneda);
      if (puntos > 0) {
        await db.movimientos_puntos.create({
          data: {
            cliente_id: orden.cliente_id,
            empresa_id: orden.empresa_id,
            sucursal_id: orden.sucursal_id,
            tipo: 'GANANCIA',
            puntos,
            orden_id: orden.id,
            motivo: 'Consumo',
          },
        });
        puntosOtorgados += puntos;
      }
    }

    const clientes = [...new Set(pendientes.map((orden) => orden.cliente_id))];
    for (const clienteId of clientes) {
      await this.recalcularCon(db, clienteId);
    }

    if (puntosOtorgados > 0) {
      this.logger.log(
        `CRM: ${puntosOtorgados} puntos a ${clientes.length} cliente(s)`,
      );
    }

    return { puntos: puntosOtorgados, clientes: clientes.length };
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async consumosCron(): Promise<void> {
    try {
      await this.procesarConsumos();
    } catch (error) {
      this.logger.warn(`CRM: no se pudieron procesar los consumos: ${String(error)}`);
    }
  }

  /* ------------------------------- internos ------------------------------ */

  private async recalcularCon(
    db: DbClient,
    clienteId: string,
  ): Promise<{ puntos?: number; visitas?: number; segmento?: string } | null> {
    const visitas = await db.ordenes.count({
      where: { cliente_id: clienteId, estado: 'PAGADA' },
    });

    const movimientos = (await db.movimientos_puntos.findMany({
      where: { cliente_id: clienteId },
      select: { tipo: true, puntos: true },
    })) as { tipo: 'GANANCIA' | 'CANJE' | 'CADUCIDAD'; puntos: number }[];

    const puntos = movimientos.reduce(
      (suma, movimiento) => suma + deltaPuntos(movimiento.tipo, movimiento.puntos),
      0,
    );
    const config = await this.configDe(await this.empresaDe(db, clienteId));

    const [ultima] = (await db.ordenes.findMany({
      where: { cliente_id: clienteId, estado: 'PAGADA' },
      select: { created_at: true },
      orderBy: { created_at: 'desc' },
      take: 1,
    })) as { created_at: Date }[];

    await db.clientes.updateMany({
      where: { id: clienteId },
      data: {
        visitas,
        puntos: Math.max(0, puntos),
        segmento: segmentoPorVisitas(visitas, config),
        ...(ultima ? { ultima_visita: ultima.created_at } : {}),
      },
    });

    return db.clientes.findFirst({ where: { id: clienteId } }) as Promise<{
      puntos?: number;
      visitas?: number;
      segmento?: string;
    } | null>;
  }

  private async empresaDe(db: DbClient, clienteId: string): Promise<string> {
    const cliente = (await db.clientes.findFirst({
      where: { id: clienteId },
      select: { empresa_id: true },
    })) as { empresa_id: string } | null;
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    return cliente.empresa_id;
  }

  private async configDe(empresaId: string): Promise<ConfigLealtad> {
    const config = (await (
      this.prisma.raw as unknown as {
        config_lealtad: { findUnique: (args: unknown) => Promise<unknown> };
      }
    ).config_lealtad.findUnique({ where: { empresa_id: empresaId } })) as
      | {
          puntos_por_moneda: unknown;
          caducidad_meses: number;
          umbral_frecuente: number;
          umbral_vip: number;
        }
      | null;

    if (!config) return CONFIG_POR_DEFECTO;
    return {
      puntos_por_moneda: Number(config.puntos_por_moneda),
      caducidad_meses: config.caducidad_meses,
      umbral_frecuente: config.umbral_frecuente,
      umbral_vip: config.umbral_vip,
    };
  }

  private tenant(): { empresaId: string; userId: string | null } {
    const context = this.tenantContext.get();
    if (!context?.empresaId) {
      throw new BadRequestException('La operación requiere empresa en el token');
    }
    return { empresaId: context.empresaId, userId: context.userId ?? null };
  }

  /**
   * Sucursal del movimiento de puntos: la del token o, para `ADMIN_GLOBAL`
   * (que no la lleva), la indicada en el body y validada contra su empresa.
   */
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
}
