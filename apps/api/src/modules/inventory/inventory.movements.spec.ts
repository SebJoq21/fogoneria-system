import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryService } from './inventory.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

function buildPrisma() {
  return {
    scoped: {
      movimientos_inventario: { findMany: vi.fn().mockResolvedValue([]) },
    },
  };
}

const FILA = {
  id: 'm1',
  created_at: new Date('2026-11-06T18:00:00.000Z'),
  tipo: 'SALIDA',
  insumo_id: 'i1',
  cantidad: '2.5',
  stock_resultante: '7.5',
  motivo: 'Comanda ORD-000123',
  insumos: { id: 'i1', nombre: 'Papa', unidad: 'kg' },
  ordenes: { numero_orden: 'ORD-000123' },
};

describe('InventoryService.listMovements (AYCDS-24)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let audit: { record: ReturnType<typeof vi.fn> };

  function buildService(contexto: { empresaId: string; sucursalId: string | null }) {
    return new InventoryService(
      prisma as unknown as PrismaService,
      { get: () => ({ ...contexto, userId: 'u1' }) } as unknown as TenantContextService,
      audit as unknown as AuditService,
    );
  }

  beforeEach(() => {
    prisma = buildPrisma();
    audit = { record: vi.fn().mockResolvedValue(undefined) };
  });

  it('mapea el kardex con insumo, unidad y folio', async () => {
    prisma.scoped.movimientos_inventario.findMany.mockResolvedValue([FILA]);
    const service = buildService({ empresaId: 'e1', sucursalId: 's1' });

    const resultado = await service.listMovements({});

    expect(resultado.items[0]).toEqual({
      id: 'm1',
      fecha: '2026-11-06T18:00:00.000Z',
      tipo: 'SALIDA',
      insumoId: 'i1',
      insumo: 'Papa',
      unidad: 'kg',
      cantidad: 2.5,
      stockResultante: 7.5,
      motivo: 'Comanda ORD-000123',
      orden: 'ORD-000123',
    });
    expect(resultado.sucursalId).toBe('s1');
  });

  it('usa la sucursal del token y rechaza otra', async () => {
    const service = buildService({ empresaId: 'e1', sucursalId: 's1' });

    await service.listMovements({});
    expect(prisma.scoped.movimientos_inventario.findMany.mock.calls[0][0].where).toMatchObject({
      sucursal_id: 's1',
    });

    await expect(service.listMovements({ sucursalId: 's2' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('el admin sin sucursal ve todas y aplica el límite por defecto', async () => {
    const service = buildService({ empresaId: 'e1', sucursalId: null });

    await service.listMovements({});

    const args = prisma.scoped.movimientos_inventario.findMany.mock.calls[0][0];
    expect(args.where.sucursal_id).toBeUndefined();
    expect(args.take).toBe(100);
  });

  it('filtra por tipo y ventana de fechas de Lima', async () => {
    const service = buildService({ empresaId: 'e1', sucursalId: 's1' });

    await service.listMovements({ tipo: 'SALIDA', desde: '2026-11-01', hasta: '2026-11-06' });

    const { where } = prisma.scoped.movimientos_inventario.findMany.mock.calls[0][0];
    expect(where.tipo).toBe('SALIDA');
    expect(where.created_at.gte.toISOString()).toBe('2026-11-01T05:00:00.000Z');
    expect(where.created_at.lt.toISOString()).toBe('2026-11-07T05:00:00.000Z');
  });

  it('respeta el límite máximo pedido', async () => {
    const service = buildService({ empresaId: 'e1', sucursalId: 's1' });

    await service.listMovements({ limit: 25 });

    expect(prisma.scoped.movimientos_inventario.findMany.mock.calls[0][0].take).toBe(25);
  });
});
