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

import { pricingApi, toListaPrecio, toPrecioPlato } from './api';

beforeEach(() => {
  for (const fn of Object.values(cliente)) fn.mockReset();
});

describe('mapeos de precios', () => {
  it('normaliza la lista de precios y el precio suelto', () => {
    expect(
      toListaPrecio(
        {
          id: 'l-1',
          nombre: 'Carta',
          activa: true,
          vigencia_desde: '2026-01-01T00:00:00.000Z',
          vigencia_hasta: null,
        },
        { 'p-1': 24.9 },
      ),
    ).toEqual({
      id: 'l-1',
      nombre: 'Carta',
      activa: true,
      vigenciaDesde: '2026-01-01',
      vigenciaHasta: '',
      precios: { 'p-1': 24.9 },
    });
    expect(toPrecioPlato({ lista_id: 'l-1', plato_id: 'p-1', precio: '24.90' })).toEqual({
      listaId: 'l-1',
      platoId: 'p-1',
      precio: 24.9,
    });
  });
});

describe('pricingApi lecturas', () => {
  it('lista los precios de una lista', async () => {
    cliente.get.mockResolvedValueOnce([
      { lista_id: 'l-1', plato_id: 'p-1', precio: '24.90' },
    ]);
    const precios = await pricingApi.listPrecios('l-1');
    expect(cliente.get).toHaveBeenLastCalledWith('/pricing/price-lists/l-1/prices', {
      signal: undefined,
    });
    expect(precios[0].precio).toBe(24.9);
  });
});
