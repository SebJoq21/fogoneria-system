// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  products: [] as unknown[],
  categories: [] as unknown[],
  priceLists: [] as unknown[],
  catalogLoading: false,
  catalogError: null as string | null,
  categoryNameOf: vi.fn(() => 'Fondos'),
  createPriceList: vi.fn(),
  activatePriceList: vi.fn(),
  setPrice: vi.fn(),
}));

const avisos = vi.hoisted(() => ({ notify: vi.fn() }));

vi.mock('@/components/dashboard/providers/catalog', () => ({ useCatalogoState: () => estado }));
vi.mock('@/components/dashboard/providers/notifications', () => ({ useNotifications: () => avisos }));

import { usePricing } from './hooks';

const producto = {
  id: 'p-1',
  sku: 'LOM',
  name: 'Lomo saltado',
  description: 'Con papas',
  categoryId: 'c-1',
  image: 'https://cdn/foto.jpg',
  status: 'Activo',
  modifierGroupIds: ['g-1'],
};
const categoria = { id: 'c-1', name: 'Fondos', position: 1 };
const lista = {
  id: 'l-1',
  name: 'Carta',
  active: true,
  validFrom: '2026-01-01',
  validTo: '2026-12-31',
  prices: { 'p-1': 24.9 },
};

describe('usePricing', () => {
  beforeEach(() => {
    estado.products = [producto];
    estado.categories = [categoria];
    estado.priceLists = [lista];
    estado.catalogLoading = false;
    estado.catalogError = null;
    avisos.notify.mockReset();
    for (const fn of [estado.createPriceList, estado.activatePriceList, estado.setPrice]) {
      fn.mockReset();
    }
  });

  it('traduce listas y platos al contrato de precios', () => {
    const { result } = renderHook(() => usePricing());
    expect(result.current.listas[0]).toMatchObject({
      id: 'l-1',
      nombre: 'Carta',
      activa: true,
      vigenciaDesde: '2026-01-01',
      vigenciaHasta: '2026-12-31',
    });
    expect(result.current.platos[0]).toMatchObject({ id: 'p-1', nombre: 'Lomo saltado' });
    expect(result.current.resumenListas.kpis.length).toBeGreaterThan(0);
    expect(result.current.cargando).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sin listas deja el resumen en cero', () => {
    estado.priceLists = [];
    const { result } = renderHook(() => usePricing());
    expect(result.current.listas).toEqual([]);
    expect(result.current.resumenListas.kpis[0].value).toBe('0');
  });

  it('crea, activa y fija precios delegando en el provider', async () => {
    const { result } = renderHook(() => usePricing());

    await act(async () => {
      await result.current.crearLista('Delivery', 'l-1');
      await result.current.activarLista('l-1');
      await result.current.fijarPrecio({ listaId: 'l-1', platoId: 'p-1', precio: 30 });
    });

    expect(estado.createPriceList).toHaveBeenCalledWith('Delivery', 'l-1');
    expect(estado.activatePriceList).toHaveBeenCalledWith('l-1');
    expect(estado.setPrice).toHaveBeenCalledWith('l-1', 'p-1', 30);
  });

  it('propaga el error de carga tal cual', () => {
    estado.catalogError = 'No se pudo cargar';
    const { result } = renderHook(() => usePricing());
    expect(result.current.error).toBe('No se pudo cargar');
  });
});
