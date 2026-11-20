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

import {
  IMAGEN_PLATO_POR_DEFECTO,
  catalogoApi,
  toCategoria,
  toGrupoModificador,
  toListaPrecio,
  toPlato,
  toPrecioPlato,
} from './api';

const apiCategoria = { id: 'cat-1', nombre: 'Fondos', posicion: 1 };

const apiPlato = {
  id: 'p-1',
  categoria_id: 'cat-1',
  sku: 'LOM-001',
  nombre: 'Lomo saltado',
  descripcion: 'Con papas',
  foto_url: 'https://cdn/foto.jpg',
  activo: true,
  platos_grupos_modificadores: [{ grupo_id: 'g-1' }],
};

beforeEach(() => {
  for (const fn of Object.values(cliente)) fn.mockReset();
});

describe('mapeos del catálogo', () => {
  it('traduce la categoría y el plato con sus grupos', () => {
    expect(toCategoria(apiCategoria)).toEqual(apiCategoria);
    expect(toPlato(apiPlato)).toEqual({
      id: 'p-1',
      sku: 'LOM-001',
      nombre: 'Lomo saltado',
      descripcion: 'Con papas',
      categoriaId: 'cat-1',
      imagen: 'https://cdn/foto.jpg',
      estado: 'Activo',
      grupoIds: ['g-1'],
    });
  });

  it('usa imagen por defecto y descripción vacía si faltan', () => {
    const plato = toPlato({
      ...apiPlato,
      descripcion: null,
      foto_url: null,
      activo: false,
      platos_grupos_modificadores: undefined,
    });
    expect(plato.imagen).toBe(IMAGEN_PLATO_POR_DEFECTO);
    expect(plato.descripcion).toBe('');
    expect(plato.estado).toBe('Inactivo');
    expect(plato.grupoIds).toEqual([]);
  });

  it('traduce el grupo de modificadores y sus precios decimales', () => {
    expect(
      toGrupoModificador({
        id: 'g-1',
        nombre: 'Término',
        obligatorio: true,
        permite_multiple: false,
        opciones_modificadores: [
          { id: 'o-1', nombre: 'Medio', precio_extra: '0.00' },
          { id: 'o-2', nombre: 'Tres cuartos', precio_extra: 2 },
        ],
      }),
    ).toEqual({
      id: 'g-1',
      nombre: 'Término',
      obligatorio: true,
      multiple: false,
      opciones: [
        { id: 'o-1', nombre: 'Medio', extra: 0 },
        { id: 'o-2', nombre: 'Tres cuartos', extra: 2 },
      ],
    });
  });

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

describe('catalogoApi lecturas', () => {
  it('lista categorías, grupos y precios de una lista', async () => {
    cliente.get.mockResolvedValueOnce([apiCategoria]);
    await expect(catalogoApi.listCategorias()).resolves.toEqual([apiCategoria]);
    expect(cliente.get).toHaveBeenCalledWith('/catalog/categories', { signal: undefined });

    cliente.get.mockResolvedValueOnce([
      {
        id: 'g-1',
        nombre: 'Término',
        obligatorio: true,
        permite_multiple: false,
        opciones_modificadores: [],
      },
    ]);
    const grupos = await catalogoApi.listGruposModificadores();
    expect(cliente.get).toHaveBeenLastCalledWith('/catalog/modifier-groups', {
      signal: undefined,
    });
    expect(grupos[0].id).toBe('g-1');

    cliente.get.mockResolvedValueOnce([
      { lista_id: 'l-1', plato_id: 'p-1', precio: '24.90' },
    ]);
    const precios = await catalogoApi.listPrecios('l-1');
    expect(cliente.get).toHaveBeenLastCalledWith('/pricing/price-lists/l-1/prices', {
      signal: undefined,
    });
    expect(precios[0].precio).toBe(24.9);
  });

  it('lista platos paginando hasta el total', async () => {
    cliente.get
      .mockResolvedValueOnce({ items: [apiPlato], total: 150, page: 1, limit: 100 })
      .mockResolvedValueOnce({
        items: [{ ...apiPlato, id: 'p-101' }],
        total: 150,
        page: 2,
        limit: 100,
      });
    const platos = await catalogoApi.listPlatos();
    expect(cliente.get).toHaveBeenNthCalledWith(
      1,
      '/catalog/dishes?limit=100&page=1',
      { signal: undefined },
    );
    expect(cliente.get).toHaveBeenNthCalledWith(
      2,
      '/catalog/dishes?limit=100&page=2',
      { signal: undefined },
    );
    expect(platos.map((plato) => plato.id)).toEqual(['p-1', 'p-101']);
  });

  it('con 100 platos o menos no pide una segunda página', async () => {
    cliente.get.mockResolvedValue({ items: [apiPlato], total: 1, page: 1, limit: 100 });
    await catalogoApi.listPlatos();
    expect(cliente.get).toHaveBeenCalledTimes(1);
  });

  it('arma el snapshot con maestros y precios de todas las listas', async () => {
    const lista = {
      id: 'l-1',
      nombre: 'Carta',
      activa: true,
      vigencia_desde: null,
      vigencia_hasta: null,
    };
    cliente.get.mockImplementation(async (url: string) => {
      if (url.startsWith('/catalog/categories')) return [apiCategoria];
      if (url.startsWith('/catalog/modifier-groups')) return [];
      if (url.startsWith('/catalog/dishes')) return { items: [apiPlato], total: 1 };
      if (url === '/pricing/price-lists') return [lista];
      if (url === '/pricing/price-lists/l-1/prices') {
        return [{ lista_id: 'l-1', plato_id: 'p-1', precio: '24.90' }];
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    const snapshot = await catalogoApi.snapshot();

    expect(snapshot.categorias).toHaveLength(1);
    expect(snapshot.platos[0].id).toBe('p-1');
    expect(snapshot.grupos).toEqual([]);
    expect(snapshot.listas[0].precios).toEqual({ 'p-1': 24.9 });
  });
});
