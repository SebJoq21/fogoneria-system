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
  catalogApi,
  toCategoria,
  toGrupoModificador,
  toPlato,
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
});

describe('catalogApi lecturas', () => {
  it('lista categorías y grupos', async () => {
    cliente.get.mockResolvedValueOnce([apiCategoria]);
    await expect(catalogApi.listCategorias()).resolves.toEqual([apiCategoria]);
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
    const grupos = await catalogApi.listGruposModificadores();
    expect(cliente.get).toHaveBeenLastCalledWith('/catalog/modifier-groups', {
      signal: undefined,
    });
    expect(grupos[0].id).toBe('g-1');
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
    const platos = await catalogApi.listPlatos();
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
    await catalogApi.listPlatos();
    expect(cliente.get).toHaveBeenCalledTimes(1);
  });
});
