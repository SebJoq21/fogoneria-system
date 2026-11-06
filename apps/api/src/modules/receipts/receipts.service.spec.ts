import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceiptsService, desgloseIgv } from './receipts.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';
import type { SequencesService } from '../../common/sequences/sequences.service.js';
import type { AuditService } from '../audit/audit.service.js';

const context = {
  userId: 'u1',
  empresaId: 'e1',
  sucursalId: 's1',
  rol: 'CAJERO' as const,
  bypass: false,
};

const ORDEN = '11111111-1111-4111-8111-111111111111';
const COMPROBANTE = '22222222-2222-4222-8222-222222222222';
const RUC_VALIDO = '20123456786';

function buildPrisma() {
  return {
    scoped: {
      ordenes: { findFirst: vi.fn() },
      comprobantes: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
    },
  };
}

describe('ReceiptsService (AYCDS-36)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let sequences: { nextComprobante: ReturnType<typeof vi.fn> };
  let audit: { record: ReturnType<typeof vi.fn> };

  function buildService(tenant: Record<string, unknown> = context) {
    return new ReceiptsService(
      prisma as unknown as PrismaService,
      { get: () => tenant } as unknown as TenantContextService,
      sequences as unknown as SequencesService,
      audit as unknown as AuditService,
    );
  }

  beforeEach(() => {
    prisma = buildPrisma();
    sequences = {
      nextComprobante: vi.fn().mockResolvedValue('B001-00000001'),
    };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    vi.clearAllMocks();
    prisma.scoped.comprobantes.findMany.mockResolvedValue([]);
    prisma.scoped.ordenes.findFirst.mockResolvedValue({
      id: ORDEN,
      numero_orden: 'ORD-000010',
      estado: 'PAGADA',
      total: 118,
      sucursal_id: 's1',
    });
  });

  describe('emisión', () => {
    it('emite con serie y correlativo de la empresa', async () => {
      prisma.scoped.comprobantes.findFirst.mockResolvedValue(null);
      prisma.scoped.comprobantes.create.mockResolvedValue({
        id: COMPROBANTE,
        serie_numero: 'B001-00000001',
        total: 118,
      });
      const service = buildService();

      const result = await service.create({
        ordenId: ORDEN,
        tipo: 'BOLETA',
        clienteRef: '12345678',
      });

      expect(sequences.nextComprobante).toHaveBeenCalledWith('e1', 'B001');
      expect(prisma.scoped.comprobantes.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tipo: 'BOLETA',
          serie_numero: 'B001-00000001',
          orden_id: ORDEN,
          cliente_ref: '12345678',
          total: 118,
          emitido_por: 'u1',
        }),
      });
      expect(result.desglose).toEqual({ base: 100, igv: 18, total: 118, tasa: 18 });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'comprobante.emitido' }),
      );
    });

    it('usa la serie F001 para la factura', async () => {
      prisma.scoped.comprobantes.findFirst.mockResolvedValue(null);
      prisma.scoped.comprobantes.create.mockResolvedValue({ id: COMPROBANTE });
      sequences.nextComprobante.mockResolvedValue('F001-00000001');
      const service = buildService();

      await service.create({ ordenId: ORDEN, tipo: 'FACTURA', clienteRef: RUC_VALIDO });

      expect(sequences.nextComprobante).toHaveBeenCalledWith('e1', 'F001');
    });

    it('rechaza la factura sin RUC', async () => {
      const service = buildService();

      await expect(
        service.create({ ordenId: ORDEN, tipo: 'FACTURA' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.scoped.comprobantes.create).not.toHaveBeenCalled();
    });

    it('rechaza un RUC con dígito inválido', async () => {
      const service = buildService();

      await expect(
        service.create({ ordenId: ORDEN, tipo: 'FACTURA', clienteRef: '20123456780' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza un DNI que no tiene 8 dígitos', async () => {
      const service = buildService();

      await expect(
        service.create({ ordenId: ORDEN, tipo: 'BOLETA', clienteRef: '123' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('solo emite sobre una comanda PAGADA', async () => {
      prisma.scoped.ordenes.findFirst.mockResolvedValue({
        id: ORDEN,
        numero_orden: 'ORD-000010',
        estado: 'ENTREGADO',
        total: 118,
        sucursal_id: 's1',
      });
      const service = buildService();

      await expect(
        service.create({ ordenId: ORDEN, tipo: 'BOLETA' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('no permite dos comprobantes vivos para la misma comanda', async () => {
      prisma.scoped.comprobantes.findFirst.mockResolvedValue({
        id: COMPROBANTE,
        serie_numero: 'B001-00000001',
      });
      const service = buildService();

      await expect(
        service.create({ ordenId: ORDEN, tipo: 'BOLETA' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(sequences.nextComprobante).not.toHaveBeenCalled();
    });

    it('devuelve 404 si la orden no es del tenant', async () => {
      prisma.scoped.ordenes.findFirst.mockResolvedValue(null);
      const service = buildService();

      await expect(
        service.create({ ordenId: ORDEN, tipo: 'BOLETA' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('anulación', () => {
    it('marca ANULADA con actor, fecha y motivo', async () => {
      prisma.scoped.comprobantes.findFirst
        .mockResolvedValueOnce({
          id: COMPROBANTE,
          serie_numero: 'B001-00000001',
          estado: 'PAGADA',
          sucursal_id: 's1',
          total: 118,
        })
        .mockResolvedValueOnce({
          id: COMPROBANTE,
          estado: 'ANULADA',
          total: 118,
          ordenes: { id: ORDEN, numero_orden: 'ORD-000010', total: 118 },
        });
      prisma.scoped.comprobantes.updateMany.mockResolvedValue({ count: 1 });
      const service = buildService();

      const result = await service.void(COMPROBANTE, 'Cliente desistió');

      expect(prisma.scoped.comprobantes.updateMany).toHaveBeenCalledWith({
        where: { id: COMPROBANTE, estado: 'PAGADA' },
        data: expect.objectContaining({
          estado: 'ANULADA',
          anulado_por: 'u1',
          motivo_anulacion: 'Cliente desistió',
        }),
      });
      expect(result.comprobante).toMatchObject({ estado: 'ANULADA' });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'comprobante.anulado' }),
      );
    });

    it('rechaza anular dos veces', async () => {
      prisma.scoped.comprobantes.findFirst.mockResolvedValue({
        id: COMPROBANTE,
        serie_numero: 'B001-00000001',
        estado: 'ANULADA',
      });
      const service = buildService();

      await expect(
        service.void(COMPROBANTE, 'Otra vez'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('devuelve 404 si el comprobante no existe', async () => {
      prisma.scoped.comprobantes.findFirst.mockResolvedValue(null);
      const service = buildService();

      await expect(
        service.void('otro', 'Motivo'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('listado', () => {
    it('filtra por sucursal del token y por tipo', async () => {
      const service = buildService();

      await service.list({ page: 1, limit: 20, tipo: 'BOLETA' });

      const arg = prisma.scoped.comprobantes.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(arg.where).toMatchObject({ sucursal_id: 's1', tipo: 'BOLETA' });
    });

    it('acota el día en hora de Lima', async () => {
      const service = buildService();

      await service.list({ page: 1, limit: 20, fecha: '2026-11-06' });

      const arg = prisma.scoped.comprobantes.findMany.mock.calls[0][0] as {
        where: { created_at?: { gte: Date; lte: Date } };
      };
      expect(arg.where.created_at).toBeDefined();
      expect(arg.where.created_at?.gte.toISOString()).toBe('2026-11-06T05:00:00.000Z');
    });

    it('rechaza otra sucursal si el token está atado a una', async () => {
      const service = buildService();

      await expect(
        service.list({ page: 1, limit: 20, sucursalId: 's-otra' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

describe('desglose de IGV', () => {
  it('separa base e IGV de un total que ya los incluye', () => {
    expect(desgloseIgv(118)).toEqual({ base: 100, igv: 18, total: 118, tasa: 18 });
  });

  it('redondea a dos decimales', () => {
    const { base, igv, total } = desgloseIgv(36);
    expect(base).toBe(30.51);
    expect(igv).toBe(5.49);
    expect(igv + base).toBeCloseTo(total, 2);
  });
});
