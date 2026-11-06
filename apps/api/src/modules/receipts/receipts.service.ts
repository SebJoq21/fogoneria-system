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
import { isValidRuc } from '../../common/utils/ruc.js';
import { limaDayRange } from '../../common/utils/lima-day.js';
import { paginationOf } from '../../common/dto/pagination.dto.js';
import type { tipo_comprobante } from '../../generated/prisma/enums.js';
import type {
  CreateReceiptDto,
  ListReceiptsQueryDto,
  ReceiptIgv,
} from './dto/receipts.dto.js';

/** Tasa de IGV vigente en Perú. El total de la comanda ya la incluye. */
export const IGV_TASA = 18;

const SERIE_POR_TIPO: Record<tipo_comprobante, 'B001' | 'F001' | 'T001'> = {
  BOLETA: 'B001',
  FACTURA: 'F001',
  TICKET: 'T001',
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Desglose del IGV de un total que ya lo incluye.
 *
 * Perú: el precio de carta lleva IGV. `base = total / 1.18`, `igv = total - base`.
 */
export function desgloseIgv(total: number, tasa: number = IGV_TASA): ReceiptIgv {
  const base = round2(total / (1 + tasa / 100));
  return { base, igv: round2(total - base), total: round2(total), tasa };
}

/**
 * Comprobantes de pago (AYCDS-36).
 *
 * Se emite **solo sobre una comanda pagada** (el cobro es AYCDS-34): el
 * comprobante es el documento fiscal de un cobro que ya existe, no una forma de
 * cobrar. La anulación no revierte nada aquí: la base lo hace con los triggers
 * de AYCDS-39 cuando están desplegados.
 *
 * El correlativo vive en `secuencias` por empresa y serie (`B001-00000042`),
 * nunca en el reloj ni en `COUNT(*)`.
 */
@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly sequences: SequencesService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateReceiptDto) {
    const { empresaId, userId } = this.tenant();
    const clienteRef = this.validateDocumento(dto.tipo, dto.clienteRef);

    const orden = await this.prisma.scoped.ordenes.findFirst({
      where: { id: dto.ordenId },
      select: {
        id: true,
        numero_orden: true,
        estado: true,
        total: true,
        sucursal_id: true,
      },
    });
    if (!orden) throw new NotFoundException('Orden no encontrada');
    if (orden.estado !== 'PAGADA') {
      throw new ConflictException(
        'Solo se emite comprobante de una comanda PAGADA (primero cobra en caja)',
      );
    }

    const existente = await this.prisma.scoped.comprobantes.findFirst({
      where: { orden_id: orden.id, estado: 'PAGADA' },
      select: { id: true, serie_numero: true },
    });
    if (existente) {
      throw new ConflictException(
        `La comanda ya tiene el comprobante ${existente.serie_numero}`,
      );
    }

    const serie = SERIE_POR_TIPO[dto.tipo];
    const serieNumero = await this.sequences.nextComprobante(empresaId, serie);
    const total = Number(orden.total);

    let comprobante;
    try {
      comprobante = await this.prisma.scoped.comprobantes.create({
        data: {
          empresa_id: empresaId,
          sucursal_id: orden.sucursal_id,
          tipo: dto.tipo,
          serie_numero: serieNumero,
          orden_id: orden.id,
          cliente_ref: clienteRef,
          total,
          estado: 'PAGADA',
          emitido_por: userId,
        },
      });
    } catch (error) {
      // `uq_comp_empresa_serie`: dos emisiones a la vez no repiten número.
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'El número de comprobante ya existe: reintenta la emisión',
        );
      }
      throw error;
    }

    await this.audit.record({
      empresaId,
      sucursalId: orden.sucursal_id,
      usuarioId: userId,
      accion: 'comprobante.emitido',
      entidad: 'comprobantes',
      entidadId: comprobante.id,
      detalle: {
        serieNumero,
        tipo: dto.tipo,
        numeroOrden: orden.numero_orden,
        total,
        clienteRef,
      },
    });

    return { comprobante, desglose: desgloseIgv(total) };
  }

  async void(id: string, motivo: string) {
    const { empresaId, userId } = this.tenant();
    const comprobante = await this.prisma.scoped.comprobantes.findFirst({
      where: { id },
      select: { id: true, serie_numero: true, estado: true, sucursal_id: true, total: true },
    });
    if (!comprobante) throw new NotFoundException('Comprobante no encontrado');
    if (comprobante.estado === 'ANULADA') {
      throw new ConflictException(
        `El comprobante ${comprobante.serie_numero} ya está anulado`,
      );
    }

    // La base exige actor, fecha y motivo (`DB_ANULACION_INCOMPLETA`); aquí se
    // mandan los tres. La reversión de caja/stock la hacen los triggers de
    // AYCDS-39, no este servicio.
    const { count } = await this.prisma.scoped.comprobantes.updateMany({
      where: { id, estado: 'PAGADA' },
      data: {
        estado: 'ANULADA',
        anulado_por: userId,
        anulado_at: new Date(),
        motivo_anulacion: motivo,
      },
    });
    if (count === 0) {
      throw new ConflictException('El comprobante ya estaba anulado');
    }

    await this.audit.record({
      empresaId,
      sucursalId: comprobante.sucursal_id,
      usuarioId: userId,
      accion: 'comprobante.anulado',
      entidad: 'comprobantes',
      entidadId: comprobante.id,
      detalle: {
        serieNumero: comprobante.serie_numero,
        total: Number(comprobante.total),
        motivo,
      },
    });

    return this.findOne(id);
  }

  async list(query: ListReceiptsQueryDto) {
    const { skip, take } = paginationOf(query);
    const sucursalId = this.resolveSucursalFiltro(query.sucursalId);
    const rango = query.fecha ? limaDayRange(query.fecha) : null;

    const where = {
      ...(query.tipo ? { tipo: query.tipo } : {}),
      ...(query.estado ? { estado: query.estado } : {}),
      ...(sucursalId ? { sucursal_id: sucursalId } : {}),
      ...(rango ? { created_at: { gte: rango.start, lte: rango.end } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.scoped.comprobantes.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
        include: {
          ordenes: { select: { id: true, numero_orden: true, total: true } },
          usuarios_comprobantes_emitido_porTousuarios: { select: { id: true, nombre: true } },
        },
      }),
      this.prisma.scoped.comprobantes.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async findOne(id: string) {
    const comprobante = await this.prisma.scoped.comprobantes.findFirst({
      where: { id },
      include: {
        ordenes: { select: { id: true, numero_orden: true, total: true } },
        usuarios_comprobantes_emitido_porTousuarios: { select: { id: true, nombre: true } },
        usuarios_comprobantes_anulado_porTousuarios: { select: { id: true, nombre: true } },
      },
    });
    if (!comprobante) throw new NotFoundException('Comprobante no encontrado');
    return {
      comprobante,
      desglose: desgloseIgv(Number(comprobante.total)),
    };
  }

  /**
   * Documento del cliente: la factura exige RUC con dígito válido; la boleta
   * acepta DNI de 8 dígitos; el ticket no pide documento.
   */
  private validateDocumento(
    tipo: tipo_comprobante,
    clienteRef?: string,
  ): string | null {
    const ref = clienteRef?.trim() ?? "";

    if (tipo === 'FACTURA') {
      if (!ref) {
        throw new BadRequestException('La factura requiere el RUC del cliente');
      }
      if (!isValidRuc(ref)) {
        throw new BadRequestException('El RUC de la factura no es válido');
      }
      return ref;
    }

    if (!ref) return null;
    if (!/^\d{8}$/.test(ref)) {
      throw new BadRequestException('El DNI de la boleta debe tener 8 dígitos');
    }
    return ref;
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

  private tenant(): { empresaId: string; userId: string | null } {
    const context = this.tenantContext.get();
    if (!context?.empresaId) {
      throw new BadRequestException('La operación requiere empresa en el token');
    }
    return { empresaId: context.empresaId, userId: context.userId ?? null };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}
