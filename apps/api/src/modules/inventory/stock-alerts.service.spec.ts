import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StockAlertsService } from './stock-alerts.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

const BAJO = {
  empresa_id: 'e1',
  sucursal_id: 's1',
  insumo_id: 'i1',
  nombre: 'Papa',
  unidad: 'kg',
  cantidad: 2,
  stock_minimo: 5,
  estado: 'BAJO' as const,
};

function buildPrisma() {
  return {
    rls: {
      $queryRawUnsafe: vi.fn(),
      alertas_stock: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    },
    raw: {
      $queryRawUnsafe: vi.fn(),
      alertas_stock: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      empresas: { findMany: vi.fn().mockResolvedValue([]) },
    },
  };
}

describe('StockAlertsService (AYCDS-13)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let audit: { record: ReturnType<typeof vi.fn> };
  let fetchMock: ReturnType<typeof vi.fn>;

  function buildService(
    contexto: { empresaId: string; sucursalId: string | null; userId?: string } = {
      empresaId: 'e1',
      sucursalId: 's1',
      userId: 'u1',
    },
  ) {
    return new StockAlertsService(
      prisma as unknown as PrismaService,
      { get: () => ({ ...contexto, tx: undefined }) } as unknown as TenantContextService,
      audit as unknown as AuditService,
      { get: () => 'fogoneria' } as never,
    );
  }

  beforeEach(() => {
    prisma = buildPrisma();
    prisma.rls.$queryRawUnsafe.mockResolvedValue([]);
    prisma.raw.$queryRawUnsafe.mockResolvedValue([]);
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    vi.stubGlobal('fetch', fetchMock);
    process.env.STOCK_WEBHOOK_URL = 'https://n8n.local/webhook/stock';
    process.env.STOCK_WEBHOOK_SECRET = 'secreto';
  });

  describe('semáforo', () => {
    it('mapea las filas y resume por estado', async () => {
      const service = buildService();
      prisma.rls.$queryRawUnsafe.mockResolvedValue([
        { sucursal_id: 's1', insumo_id: 'i1', nombre: 'Papa', unidad: 'kg', cantidad: '0', stock_minimo: '5', estado: 'AGOTADO' },
        { sucursal_id: 's1', insumo_id: 'i2', nombre: 'Arroz', unidad: 'kg', cantidad: '3', stock_minimo: '5', estado: 'BAJO' },
        { sucursal_id: 's1', insumo_id: 'i3', nombre: 'Sal', unidad: 'kg', cantidad: '9', stock_minimo: '5', estado: 'OPTIMO' },
      ]);

      const resultado = await service.status({});

      expect(resultado.resumen).toEqual({ total: 3, agotados: 1, bajos: 1, optimos: 1 });
      expect(resultado.items[0]).toMatchObject({ insumoId: 'i1', cantidad: 0, estado: 'AGOTADO' });
      expect(resultado.sucursalId).toBe('s1');
    });

    it('usa la sucursal del token y no la del query', async () => {
      const service = buildService();
      prisma.rls.$queryRawUnsafe.mockResolvedValue([]);

      await service.status({ sucursalId: 's1' });
      expect(prisma.rls.$queryRawUnsafe.mock.calls[0].slice(1)).toEqual(['s1', null]);

      await expect(service.status({ sucursalId: 's2' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('el admin sin sucursal consulta todas', async () => {
      const service = buildService({ empresaId: 'e1', sucursalId: null, userId: 'u1' });
      prisma.rls.$queryRawUnsafe.mockResolvedValue([]);

      const resultado = await service.status({});

      expect(resultado.sucursalId).toBeNull();
      expect(prisma.rls.$queryRawUnsafe.mock.calls[0].slice(1)).toEqual([null, null]);
    });
  });

  describe('alertas', () => {
    it('crea la alerta de un insumo que acaba de caer', async () => {
      const service = buildService();
      prisma.rls.$queryRawUnsafe.mockResolvedValue([BAJO]);

      const resumen = await service.checkAlerts({});

      expect(resumen).toMatchObject({ evaluados: 1, nuevas: 1, resueltas: 0, enviado: true });
      expect(prisma.rls.alertas_stock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ estado: 'BAJO', cantidad: 2 }),
        }),
      );
      expect(prisma.rls.alertas_stock.updateMany).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'stock.alertas' }),
      );
    });

    it('no repite la alerta si el estado no cambió', async () => {
      const service = buildService();
      prisma.rls.$queryRawUnsafe.mockResolvedValue([BAJO]);
      prisma.rls.alertas_stock.findMany.mockResolvedValue([
        { id: 'a1', sucursal_id: 's1', insumo_id: 'i1', estado: 'BAJO' },
      ]);

      const resumen = await service.checkAlerts({});

      expect(resumen.nuevas).toBe(0);
      expect(prisma.rls.alertas_stock.upsert).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('vuelve a notificar si el insumo pasa de BAJO a AGOTADO', async () => {
      const service = buildService();
      prisma.rls.$queryRawUnsafe.mockResolvedValue([{ ...BAJO, estado: 'AGOTADO' }]);
      prisma.rls.alertas_stock.findMany.mockResolvedValue([
        { id: 'a1', sucursal_id: 's1', insumo_id: 'i1', estado: 'BAJO' },
      ]);

      const resumen = await service.checkAlerts({});

      expect(resumen.nuevas).toBe(1);
      expect(prisma.rls.alertas_stock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: expect.objectContaining({ notificado_at: null }) }),
      );
    });

    it('borra la alerta cuando el stock se repone', async () => {
      const service = buildService();
      prisma.rls.$queryRawUnsafe.mockResolvedValue([]);
      prisma.rls.alertas_stock.findMany.mockResolvedValue([
        { id: 'a1', sucursal_id: 's1', insumo_id: 'i1', estado: 'BAJO' },
      ]);

      const resumen = await service.checkAlerts({});

      expect(resumen.resueltas).toBe(1);
      expect(prisma.rls.alertas_stock.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['a1'] } },
      });
    });

    it('firma el cuerpo con HMAC-SHA256', async () => {
      const service = buildService();
      prisma.rls.$queryRawUnsafe.mockResolvedValue([BAJO]);

      await service.checkAlerts({});

      const [, opciones] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string>; body: string }];
      expect(opciones.headers['X-Fogoneria-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/);
      expect(opciones.headers['X-Fogoneria-Event']).toBe('stock.alert');
      const payload = JSON.parse(opciones.body);
      expect(payload.alertas[0]).toMatchObject({ insumoId: 'i1', estado: 'BAJO' });
    });

    it('si el webhook falla, la alerta queda pendiente', async () => {
      const service = buildService();
      prisma.rls.$queryRawUnsafe.mockResolvedValue([BAJO]);
      fetchMock.mockResolvedValue({ ok: false, status: 500 });

      const resumen = await service.checkAlerts({});

      expect(resumen.enviado).toBe(false);
      expect(prisma.rls.alertas_stock.updateMany).not.toHaveBeenCalled();
    });

    it('sin URL no envía pero registra la alerta', async () => {
      process.env.STOCK_WEBHOOK_URL = '';
      const service = buildService();
      prisma.rls.$queryRawUnsafe.mockResolvedValue([BAJO]);

      const resumen = await service.checkAlerts({});

      expect(resumen.nuevas).toBe(1);
      expect(resumen.enviado).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('barrido de todas las empresas', () => {
    it('recorre solo empresas activas o en trial', async () => {
      const service = buildService();
      prisma.raw.empresas.findMany.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);
      prisma.raw.$queryRawUnsafe.mockResolvedValue([]);

      await service.checkAllTenants();

      expect(prisma.raw.empresas.findMany).toHaveBeenCalledWith({
        where: { deleted_at: null, estado: { in: ['ACTIVE', 'TRIAL'] } },
        select: { id: true },
      });
      expect(prisma.raw.$queryRawUnsafe).toHaveBeenCalledTimes(2);
    });

    it('no tumba el barrido si una empresa falla', async () => {
      const service = buildService();
      prisma.raw.empresas.findMany.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);
      prisma.raw.$queryRawUnsafe
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce([]);

      await expect(service.checkAllTenants()).resolves.toBeUndefined();
      expect(prisma.raw.$queryRawUnsafe).toHaveBeenCalledTimes(2);
    });
  });
});
