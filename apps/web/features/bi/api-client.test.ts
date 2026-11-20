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

import { biApi } from './api';

const rango = { desde: '2026-11-04', hasta: '2026-11-10' };

beforeEach(() => {
  for (const fn of Object.values(cliente)) fn.mockReset();
});

describe('biApi.pnl', () => {
  it('pide el P&L con el rango de Lima', async () => {
    const pnl = {
      desde: '2026-11-04',
      hasta: '2026-11-10',
      sucursalId: null,
      ventas: 288,
      comprobado: 240,
      ventaSinComprobante: 48,
      gastos: 600,
      margen: -312,
      propinas: 105,
    };
    cliente.get.mockResolvedValue(pnl);
    await expect(biApi.pnl(rango)).resolves.toEqual(pnl);
    expect(cliente.get).toHaveBeenCalledWith('/bi/pnl?desde=2026-11-04&hasta=2026-11-10', {
      signal: undefined,
    });
  });

  it('agrega la sucursal cuando viaja en el rango', async () => {
    cliente.get.mockResolvedValue({});
    await biApi.pnl({ ...rango, sucursalId: 's-1' });
    expect(cliente.get).toHaveBeenCalledWith(
      '/bi/pnl?desde=2026-11-04&hasta=2026-11-10&sucursalId=s-1',
      { signal: undefined },
    );
  });
});

describe('biApi reportes con lista', () => {
  it('desenvuelve la serie diaria y tolera items nulos', async () => {
    cliente.get.mockResolvedValue({
      desde: rango.desde,
      hasta: rango.hasta,
      sucursalId: null,
      items: [{ fecha: '2026-11-10', ventas: 288, gastos: 100, margen: 188 }],
    });
    const serie = await biApi.serie(rango);
    expect(cliente.get).toHaveBeenCalledWith(
      '/bi/pnl/daily?desde=2026-11-04&hasta=2026-11-10',
      { signal: undefined },
    );
    expect(serie).toHaveLength(1);

    cliente.get.mockResolvedValue({ items: null });
    await expect(biApi.serie(rango)).resolves.toEqual([]);
  });

  it('pide el ranking con límite y devuelve la lista', async () => {
    cliente.get.mockResolvedValue({ items: [{ platoId: 'p-1', unidades: 3 }] });
    const top = await biApi.platosTop({ ...rango, limit: 5 });
    expect(cliente.get).toHaveBeenCalledWith(
      '/bi/top-dishes?desde=2026-11-04&hasta=2026-11-10&limit=5',
      { signal: undefined },
    );
    expect(top).toHaveLength(1);

    cliente.get.mockResolvedValue(undefined);
    await expect(biApi.platosTop(rango)).resolves.toEqual([]);
  });

  it('pide los cobros por método', async () => {
    cliente.get.mockResolvedValue({ items: [{ metodo: 'EFECTIVO', cobros: 4, monto: 198 }] });
    const cobros = await biApi.cobrosPorMetodo({ ...rango, sucursalId: 's-1' });
    expect(cliente.get).toHaveBeenCalledWith(
      '/bi/sales-by-method?desde=2026-11-04&hasta=2026-11-10&sucursalId=s-1',
      { signal: undefined },
    );
    expect(cobros[0]).toMatchObject({ metodo: 'EFECTIVO', monto: 198 });
  });
});
