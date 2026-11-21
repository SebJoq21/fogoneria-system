// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  products: [] as unknown[],
  categories: [] as unknown[],
  modifierGroups: [] as unknown[],
  priceLists: [] as unknown[],
  catalogLoading: false,
  catalogError: null as string | null,
  priceOf: vi.fn(() => 24.9),
  categoryNameOf: vi.fn(() => 'Fondos'),
  saveProduct: vi.fn(),
  setProductActive: vi.fn(),
  saveCategory: vi.fn(),
  deleteCategory: vi.fn(),
  createModifierGroup: vi.fn(),
  updateModifierGroup: vi.fn(),
  deleteModifierGroup: vi.fn(),
  createPriceList: vi.fn(),
  activatePriceList: vi.fn(),
  setPrice: vi.fn(),
}));

const avisos = vi.hoisted(() => ({ notify: vi.fn() }));

vi.mock('@/components/dashboard/providers/catalog', () => ({ useCatalogoState: () => estado }));
vi.mock('@/components/dashboard/providers/notifications', () => ({ useNotifications: () => avisos }));

import { useCatalogo } from './hooks';

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
const grupo = {
  id: 'g-1',
  name: 'Término',
  required: true,
  multi: false,
  options: [{ id: 'o-1', name: 'Medio', extra: 1.5 }],
};
const lista = {
  id: 'l-1',
  name: 'Carta',
  active: true,
  validFrom: '2026-01-01',
  validTo: '2026-12-31',
  prices: { 'p-1': 24.9 },
};

describe('useCatalogo', () => {
  beforeEach(() => {
    estado.products = [producto];
    estado.categories = [categoria];
    estado.modifierGroups = [grupo];
    estado.priceLists = [lista];
    estado.catalogLoading = false;
    estado.catalogError = null;
    avisos.notify.mockReset();
    for (const fn of [
      estado.saveProduct,
      estado.setProductActive,
      estado.saveCategory,
      estado.deleteCategory,
      estado.createModifierGroup,
      estado.updateModifierGroup,
      estado.deleteModifierGroup,
      estado.createPriceList,
      estado.activatePriceList,
      estado.setPrice,
    ]) {
      fn.mockReset();
    }
  });

  it('traduce el estado del provider a los contratos de la feature', () => {
    const { result } = renderHook(() => useCatalogo());
    expect(result.current.platos[0]).toMatchObject({
      id: 'p-1',
      nombre: 'Lomo saltado',
      categoriaId: 'c-1',
      estado: 'Activo',
      grupoIds: ['g-1'],
    });
    expect(result.current.categorias[0]).toEqual({ id: 'c-1', nombre: 'Fondos', posicion: 1 });
    expect(result.current.grupos[0]).toMatchObject({
      id: 'g-1',
      nombre: 'Término',
      obligatorio: true,
      multiple: false,
      opciones: [{ id: 'o-1', nombre: 'Medio', extra: 1.5 }],
    });
    expect(result.current.listas[0]).toMatchObject({
      id: 'l-1',
      nombre: 'Carta',
      activa: true,
      vigenciaDesde: '2026-01-01',
      vigenciaHasta: '2026-12-31',
    });
    expect(result.current.listaActiva?.id).toBe('l-1');
    expect(result.current.resumenCarta.kpis.length).toBeGreaterThan(0);
    expect(result.current.resumenListas.kpis.length).toBeGreaterThan(0);
    expect(result.current.cargando).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sin listas deja listaActiva undefined y resúmenes en cero', () => {
    estado.priceLists = [];
    const { result } = renderHook(() => useCatalogo());
    expect(result.current.listaActiva).toBeUndefined();
    expect(result.current.resumenListas.kpis[0].value).toBe('0');
  });

  it('guarda y activa platos delegando en el provider', async () => {
    const { result } = renderHook(() => useCatalogo());
    await act(async () => {
      await result.current.guardarPlato({
        nombre: 'Lomo',
        descripcion: 'Con papas',
        categoriaId: 'c-1',
        imagen: 'x',
        activo: true,
        grupoIds: ['g-1'],
        precio: 24.9,
      });
    });
    expect(estado.saveProduct).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Lomo', status: 'Activo', price: 24.9 }),
    );

    await act(async () => {
      await result.current.activarPlato('p-1', false);
    });
    expect(estado.setProductActive).toHaveBeenCalledWith('p-1', false);
  });

  it('gestiona categorías, grupos, listas y precios', async () => {
    const { result } = renderHook(() => useCatalogo());

    await act(async () => {
      await result.current.guardarCategoria({ nombre: 'Bebidas', posicion: 2 });
      await result.current.borrarCategoria('c-1');
      await result.current.crearGrupo({ nombre: 'Término', obligatorio: true, multiple: false });
      await result.current.actualizarGrupo('g-1', {
        nombre: 'Término',
        obligatorio: false,
        multiple: true,
        opciones: [{ id: 'o-1', nombre: 'Medio', extra: 0 }],
      });
      await result.current.borrarGrupo('g-1');
      await result.current.crearLista('Delivery', 'l-1');
      await result.current.activarLista('l-1');
      await result.current.fijarPrecio({ listaId: 'l-1', platoId: 'p-1', precio: 30 });
    });

    expect(estado.saveCategory).toHaveBeenCalledWith({ id: undefined, name: 'Bebidas', position: 2 });
    expect(estado.deleteCategory).toHaveBeenCalledWith('c-1');
    expect(estado.createModifierGroup).toHaveBeenCalledWith({
      name: 'Término',
      required: true,
      multi: false,
    });
    expect(estado.updateModifierGroup).toHaveBeenCalledWith(
      'g-1',
      expect.objectContaining({
        name: 'Término',
        required: false,
        multi: true,
        options: [{ id: 'o-1', name: 'Medio', extra: 0 }],
      }),
    );
    expect(estado.deleteModifierGroup).toHaveBeenCalledWith('g-1');
    expect(estado.createPriceList).toHaveBeenCalledWith('Delivery', 'l-1');
    expect(estado.activatePriceList).toHaveBeenCalledWith('l-1');
    expect(estado.setPrice).toHaveBeenCalledWith('l-1', 'p-1', 30);
  });

  it('propaga el error de carga tal cual', () => {
    estado.catalogError = 'No se pudo cargar';
    const { result } = renderHook(() => useCatalogo());
    expect(result.current.error).toBe('No se pudo cargar');
  });
});
