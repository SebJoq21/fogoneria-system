import { beforeEach, describe, expect, it, vi } from 'vitest';

const cliente = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  request: vi.fn(),
}));

vi.mock('@fogoneria/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fogoneria/sdk')>();
  return { ...actual, createClient: () => cliente };
});

import { inventarioApi } from './api';

beforeEach(() => {
  for (const fn of Object.values(cliente)) fn.mockReset();
});

const stock = {
  sucursalId: 's-1',
  resumen: { total: 2, agotados: 1, bajos: 0, optimos: 1 },
  items: [
    {
      sucursalId: 's-1',
      insumoId: 'i-1',
      nombre: 'Papa',
      unidad: 'kg',
      cantidad: 0,
      stockMinimo: 5,
      estado: 'AGOTADO' as const,
    },
  ],
};

describe('inventarioApi.stock', () => {
  it('pide el semáforo con sucursal y estado', async () => {
    cliente.get.mockResolvedValue(stock);
    const resultado = await inventarioApi.stock({ sucursalId: 's-1', estado: 'AGOTADO' });
    expect(cliente.get).toHaveBeenCalledWith(
      '/inventory/stock?sucursalId=s-1&estado=AGOTADO',
      { signal: undefined },
    );
    expect(resultado.resumen.agotados).toBe(1);
  });

  it('sin filtros consulta el agregado del token', async () => {
    cliente.get.mockResolvedValue(stock);
    await inventarioApi.stock();
    expect(cliente.get).toHaveBeenCalledWith('/inventory/stock', { signal: undefined });
  });
});

describe('inventarioApi.movimientos', () => {
  it('pide el kardex con toda la ventana', async () => {
    const kardex = {
      sucursalId: 's-1',
      items: [
        {
          id: 'm-1',
          fecha: '2026-11-20T10:00:00.000Z',
          tipo: 'SALIDA' as const,
          insumoId: 'i-1',
          insumo: 'Papa',
          unidad: 'kg',
          cantidad: 2.5,
          stockResultante: 7.5,
          motivo: null,
          orden: 'ORD-1',
        },
      ],
    };
    cliente.get.mockResolvedValue(kardex);
    const resultado = await inventarioApi.movimientos({
      sucursalId: 's-1',
      insumoId: 'i-1',
      tipo: 'SALIDA',
      desde: '2026-11-01',
      hasta: '2026-11-20',
      limit: 50,
    });
    expect(cliente.get).toHaveBeenCalledWith(
      '/inventory/movements?sucursalId=s-1&insumoId=i-1&tipo=SALIDA&desde=2026-11-01&hasta=2026-11-20&limit=50',
      { signal: undefined },
    );
    expect(resultado.items).toHaveLength(1);
  });

  it('sin filtros devuelve la ventana por defecto de la API', async () => {
    cliente.get.mockResolvedValue({ sucursalId: null, items: [] });
    await inventarioApi.movimientos();
    expect(cliente.get).toHaveBeenCalledWith('/inventory/movements', { signal: undefined });
  });
});
