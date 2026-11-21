import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceiptsService } from './receipts.service.js';
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

describe('ReceiptsService (f4: conflictos y filtros)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let service: ReceiptsService;

  function build(tenant: Record<string, unknown> = context) {
    return new ReceiptsService(
      prisma as unknown as PrismaService,
      { get: () => tenant } as unknown as TenantContextService,
      { nextComprobante: vi.fn().mockResolvedValue('B001-1') } as unknown as SequencesService,
      { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService,
    );
  }

  beforeEach(() => {
    prisma = buildPrisma();
    service = build();
    prisma.scoped.ordenes.findFirst.mockResolvedValue({
      id: ORDEN,
      numero_orden: 'ORD-1',
      estado: 'PAGADA',
      total: '118',
      sucursal_id: 's1',
    });
    prisma.scoped.comprobantes.findFirst.mockResolvedValue(null);
  });

  it('traduce la carrera del correlativo y re-lanza otros errores', async () => {
    prisma.scoped.comprobantes.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.create({ ordenId: ORDEN, tipo: 'BOLETA' } as never)).rejects.toBeInstanceOf(
      ConflictException,
    );

    prisma.scoped.comprobantes.create.mockRejectedValue(new Error('db caída'));
    await expect(service.create({ ordenId: ORDEN, tipo: 'BOLETA' } as never)).rejects.toThrow(
      'db caída',
    );
  });

  it('no anula dos veces y devuelve 404 si no existe', async () => {
    prisma.scoped.comprobantes.findFirst.mockResolvedValue({
      id: COMPROBANTE,
      estado: 'PAGADA',
      sucursal_id: 's1',
      serie_numero: 'B001-1',
      total: '118',
    });
    prisma.scoped.comprobantes.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.void(COMPROBANTE, 'Error')).rejects.toBeInstanceOf(ConflictException);

    prisma.scoped.comprobantes.findFirst.mockResolvedValue(null);
    await expect(service.findOne(COMPROBANTE)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lista con tipo, estado y fecha; rechaza una fecha inválida', async () => {
    await service.list({ tipo: 'BOLETA', estado: 'PAGADA', fecha: '2026-11-20' } as never);
    expect(prisma.scoped.comprobantes.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tipo: 'BOLETA',
          estado: 'PAGADA',
          sucursal_id: 's1',
          created_at: { gte: expect.any(Date), lte: expect.any(Date) },
        }),
      }),
    );

    await expect(service.list({ fecha: '2026-13-40' } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('el admin puede pedir sucursal y el rol atado no puede cambiarla', async () => {
    const admin = build({ ...context, sucursalId: null, rol: 'ADMIN_GLOBAL' });
    await admin.list({ sucursalId: 's2' } as never);
    expect(prisma.scoped.comprobantes.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { sucursal_id: 's2' } }),
    );

    await expect(service.list({ sucursalId: 's2' } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('exige empresa en el token', async () => {
    const sinEmpresa = build({});
    await expect(
      sinEmpresa.create({ ordenId: ORDEN, tipo: 'BOLETA' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
