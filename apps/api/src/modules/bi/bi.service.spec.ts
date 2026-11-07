import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BiService } from './bi.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

const queryRawUnsafe = vi.fn();
const config = { get: () => 'fogoneria' };

function buildService(
  contexto: { empresaId?: string | null; sucursalId?: string | null } = {
    empresaId: 'e1',
    sucursalId: null,
  },
) {
  return new BiService(
    { rls: { $queryRawUnsafe: queryRawUnsafe } } as unknown as PrismaService,
    { get: () => ({ ...contexto, tx: { $queryRawUnsafe: queryRawUnsafe } }) } as unknown as TenantContextService,
    config as never,
  );
}

describe('BiService (AYCDS-35)', () => {
  beforeEach(() => {
    queryRawUnsafe.mockReset();
    queryRawUnsafe.mockResolvedValue([]);
  });

  describe('rango de fechas', () => {
    it('rechaza desde posterior a hasta', async () => {
      const service = buildService();
      await expect(
        service.pnl({ desde: '2026-11-07', hasta: '2026-11-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza un rango mayor a 12 meses', async () => {
      const service = buildService();
      await expect(
        service.pnl({ desde: '2025-01-01', hasta: '2026-11-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('acepta un rango de 366 días', async () => {
      const service = buildService();
      queryRawUnsafe.mockResolvedValue([
        { ventas: '0', comprobado: '0', venta_sin_comprobante: '0', gastos: '0', margen: '0', propinas: '0' },
      ]);

      await expect(
        service.pnl({ desde: '2025-11-06', hasta: '2026-11-06' }),
      ).resolves.toMatchObject({ desde: '2025-11-06', hasta: '2026-11-06' });
    });

    it('rechaza una fecha imposible', async () => {
      const service = buildService();
      await expect(
        service.pnl({ desde: '2026-13-45', hasta: '2026-11-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('sucursal', () => {
    it('usa la sucursal del token aunque no se indique', async () => {
      const service = buildService({ empresaId: 'e1', sucursalId: 's1' });
      queryRawUnsafe.mockResolvedValue([
        { ventas: '0', comprobado: '0', venta_sin_comprobante: '0', gastos: '0', margen: '0', propinas: '0' },
      ]);

      const resultado = await service.pnl({ desde: '2026-11-01', hasta: '2026-11-07' });

      expect(resultado.sucursalId).toBe('s1');
      expect(queryRawUnsafe.mock.calls[0].slice(1)).toEqual(['2026-11-01', '2026-11-07', 's1']);
    });

    it('rechaza una sucursal distinta a la del token', async () => {
      const service = buildService({ empresaId: 'e1', sucursalId: 's1' });
      await expect(
        service.pnl({ desde: '2026-11-01', hasta: '2026-11-07', sucursalId: 's2' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('sin sucursal en el token permite el agregado de la empresa', async () => {
      const service = buildService({ empresaId: 'e1', sucursalId: null });
      queryRawUnsafe.mockResolvedValue([
        { ventas: '0', comprobado: '0', venta_sin_comprobante: '0', gastos: '0', margen: '0', propinas: '0' },
      ]);

      const resultado = await service.pnl({ desde: '2026-11-01', hasta: '2026-11-07' });

      expect(resultado.sucursalId).toBeNull();
      expect(queryRawUnsafe.mock.calls[0].slice(1)).toEqual(['2026-11-01', '2026-11-07', null]);
    });
  });

  describe('P&L', () => {
    it('convierte los decimales y redondea a 2 cifras', async () => {
      const service = buildService();
      queryRawUnsafe.mockResolvedValue([
        {
          ventas: '1250.55',
          comprobado: '1000.00',
          venta_sin_comprobante: '250.55',
          gastos: '400.10',
          margen: '850.45',
          propinas: '80.00',
        },
      ]);

      const resultado = await service.pnl({ desde: '2026-11-01', hasta: '2026-11-07' });

      expect(resultado).toMatchObject({
        ventas: 1250.55,
        comprobado: 1000,
        ventaSinComprobante: 250.55,
        gastos: 400.1,
        margen: 850.45,
        propinas: 80,
      });
    });

    it('devuelve ceros cuando no hay filas', async () => {
      const service = buildService();
      const resultado = await service.pnl({ desde: '2026-11-01', hasta: '2026-11-07' });

      expect(resultado.ventas).toBe(0);
      expect(resultado.margen).toBe(0);
    });

    it('la serie diaria devuelve la fecha como YYYY-MM-DD', async () => {
      const service = buildService();
      queryRawUnsafe.mockResolvedValue([
        { fecha: new Date('2026-11-06T00:00:00.000Z'), ventas: '100', gastos: '30', margen: '70' },
      ]);

      const resultado = await service.pnlPorDia({ desde: '2026-11-06', hasta: '2026-11-06' });

      expect(resultado.items).toEqual([{ fecha: '2026-11-06', ventas: 100, gastos: 30, margen: 70 }]);
    });
  });

  describe('ranking y métodos', () => {
    it('el ranking pide 10 por defecto y respeta el límite', async () => {
      const service = buildService();
      queryRawUnsafe.mockResolvedValue([]);

      await service.topDishes({ desde: '2026-11-01', hasta: '2026-11-07' });
      expect(queryRawUnsafe.mock.calls[0].at(-1)).toBe(10);

      await service.topDishes({ desde: '2026-11-01', hasta: '2026-11-07', limit: 25 });
      expect(queryRawUnsafe.mock.calls[1].at(-1)).toBe(25);
    });

    it('mapea el ranking a camelCase', async () => {
      const service = buildService();
      queryRawUnsafe.mockResolvedValue([
        { plato_id: 'p1', sku: 'P-01', nombre: 'Anticucho', unidades: 12n, ingresos: '240.00' },
      ]);

      const resultado = await service.topDishes({ desde: '2026-11-01', hasta: '2026-11-07' });

      expect(resultado.items[0]).toEqual({
        platoId: 'p1',
        sku: 'P-01',
        nombre: 'Anticucho',
        unidades: 12,
        ingresos: 240,
      });
    });

    it('agrupa los cobros por método', async () => {
      const service = buildService();
      queryRawUnsafe.mockResolvedValue([
        { metodo: 'EFECTIVO', n_cobros: 3n, monto: '150.50' },
        { metodo: 'TARJETA', n_cobros: 1n, monto: '99.99' },
      ]);

      const resultado = await service.salesByMethod({ desde: '2026-11-01', hasta: '2026-11-07' });

      expect(resultado.items).toEqual([
        { metodo: 'EFECTIVO', cobros: 3, monto: 150.5 },
        { metodo: 'TARJETA', cobros: 1, monto: 99.99 },
      ]);
    });
  });

  it('consulta sobre la transacción del request (contexto RLS)', async () => {
    const service = buildService();
    queryRawUnsafe.mockResolvedValue([]);

    await service.salesByMethod({ desde: '2026-11-01', hasta: '2026-11-07' });

    // Si no fuera por la tx del contexto, las vistas security_invoker devolverían 0 filas.
    expect(queryRawUnsafe).toHaveBeenCalled();
    expect(queryRawUnsafe.mock.calls[0][0]).toContain('fogoneria.v_bi_cobros_metodo');
  });
});
