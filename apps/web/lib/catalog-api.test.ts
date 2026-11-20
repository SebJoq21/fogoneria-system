import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PRODUCT_IMAGE,
  activatePriceList,
  createCategory,
  createDish,
  createModifierGroup,
  createPriceList,
  deactivateCategory,
  deactivateModifierGroup,
  deleteDish,
  deletePriceList,
  fetchCatalog,
  setDishActive,
  setPrices,
  updateCategory,
  updateDish,
  updateModifierGroup,
} from './catalog-api';

const fetchMock = vi.fn();

type Llamada = { url: string; init: RequestInit };
let llamadas: Llamada[] = [];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Router simple: cada test decide qué devuelve cada ruta. */
function enrutar(handler: (url: string) => unknown) {
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    llamadas.push({ url, init });
    return json(handler(url));
  });
}

const categoria = { id: 'cat-1', nombre: 'Fondos', posicion: 1, activa: true };
const plato = {
  id: 'p-1',
  categoria_id: 'cat-1',
  sku: 'LOM-001',
  nombre: 'Lomo',
  descripcion: null,
  foto_url: null,
  activo: true,
  platos_grupos_modificadores: [{ grupo_id: 'g-1' }],
};
const grupo = {
  id: 'g-1',
  nombre: 'Término',
  obligatorio: true,
  permite_multiple: false,
  activo: true,
  opciones_modificadores: [{ id: 'o-1', nombre: 'Medio', precio_extra: '1.50' }],
};
const lista = {
  id: 'l-1',
  nombre: 'Carta',
  activa: true,
  vigencia_desde: '2026-01-01T00:00:00.000Z',
  vigencia_hasta: null,
};

beforeEach(() => {
  llamadas = [];
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchCatalog', () => {
  it('trae maestros y precios de todas las listas en un snapshot', async () => {
    enrutar((url) => {
      if (url.includes('/catalog/categories')) return [categoria];
      if (url.includes('/catalog/dishes')) return { items: [plato], total: 1, page: 1, limit: 100 };
      if (url.includes('/catalog/modifier-groups')) return [grupo];
      if (url.endsWith('/pricing/price-lists')) return [lista];
      if (url.includes('/pricing/price-lists/l-1/prices')) {
        return [{ lista_id: 'l-1', plato_id: 'p-1', precio: '24.90' }];
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    const snapshot = await fetchCatalog();

    expect(snapshot.categories).toEqual([{ id: 'cat-1', name: 'Fondos', position: 1 }]);
    expect(snapshot.products[0]).toMatchObject({
      id: 'p-1',
      name: 'Lomo',
      description: '',
      image: DEFAULT_PRODUCT_IMAGE,
      status: 'Activo',
      modifierGroupIds: ['g-1'],
    });
    expect(snapshot.modifierGroups[0].options[0]).toEqual({
      id: 'o-1',
      name: 'Medio',
      extra: 1.5,
    });
    expect(snapshot.priceLists[0]).toMatchObject({
      id: 'l-1',
      active: true,
      validFrom: '2026-01-01',
      validTo: '',
      prices: { 'p-1': 24.9 },
    });
  });

  it('pagina los platos hasta el total', async () => {
    enrutar((url) => {
      if (url.includes('/catalog/categories')) return [];
      if (url.includes('/catalog/modifier-groups')) return [];
      if (url.endsWith('/pricing/price-lists')) return [];
      if (url.includes('/catalog/dishes') && url.includes('page=1')) {
        return { items: [plato], total: 150, page: 1, limit: 100 };
      }
      if (url.includes('/catalog/dishes') && url.includes('page=2')) {
        return { items: [{ ...plato, id: 'p-2' }], total: 150, page: 2, limit: 100 };
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    const snapshot = await fetchCatalog();
    expect(snapshot.products.map((p) => p.id)).toEqual(['p-1', 'p-2']);
  });
});

describe('mutaciones de categorías', () => {
  it('crea, actualiza y desactiva', async () => {
    enrutar(() => ({}));

    await createCategory({ name: 'Bebidas', position: 3 });
    await updateCategory('cat-1', { name: 'Fondos', position: 2 });
    await updateCategory('cat-1', {});
    await deactivateCategory('cat-1');

    expect(llamadas[0]).toMatchObject({
      url: '/api/backend/catalog/categories',
      init: { method: 'POST', body: JSON.stringify({ nombre: 'Bebidas', posicion: 3 }) },
    });
    expect(llamadas[1]).toMatchObject({
      url: '/api/backend/catalog/categories/cat-1',
      init: { method: 'PATCH', body: JSON.stringify({ nombre: 'Fondos', posicion: 2 }) },
    });
    expect(llamadas[2].init.body).toBe('{}');
    expect(llamadas[3]).toMatchObject({ url: '/api/backend/catalog/categories/cat-1' });
    expect(llamadas[3].init.method).toBe('DELETE');
  });
});

describe('mutaciones de platos', () => {
  const dish = {
    name: 'Lomo',
    description: 'Con papas',
    categoryId: 'cat-1',
    image: 'https://cdn/foto.jpg',
    status: 'Activo' as const,
    modifierGroupIds: ['g-1'],
  };

  it('crea el plato y devuelve su id', async () => {
    enrutar(() => plato);
    const id = await createDish({ ...dish, sku: 'LOM-001' });
    expect(id).toBe('p-1');
    expect(llamadas[0]).toMatchObject({
      url: '/api/backend/catalog/dishes',
      init: {
        method: 'POST',
        body: JSON.stringify({
          categoriaId: 'cat-1',
          sku: 'LOM-001',
          nombre: 'Lomo',
          descripcion: 'Con papas',
          fotoUrl: 'https://cdn/foto.jpg',
          activo: true,
          grupoIds: ['g-1'],
        }),
      },
    });
  });

  it('actualiza, activa/desactiva y borra', async () => {
    enrutar(() => ({}));

    await updateDish('p-1', { ...dish, status: 'Inactivo' });
    await setDishActive('p-1', false);
    await deleteDish('p-1');

    expect(llamadas[0]).toMatchObject({
      url: '/api/backend/catalog/dishes/p-1',
      init: { method: 'PATCH' },
    });
    expect(JSON.parse(String(llamadas[0].init.body))).toMatchObject({ activo: false });
    expect(llamadas[1].init.body).toBe(JSON.stringify({ activo: false }));
    expect(llamadas[2].init.method).toBe('DELETE');
  });
});

describe('mutaciones de modificadores', () => {
  it('crea el grupo con sus banderas', async () => {
    enrutar(() => ({}));
    await createModifierGroup({ name: 'Término', required: true, multi: false });
    expect(llamadas[0].init.body).toBe(
      JSON.stringify({ nombre: 'Término', obligatorio: true, permiteMultiple: false }),
    );
  });

  it('actualiza solo los campos presentes y sincroniza opciones por id', async () => {
    enrutar(() => ({}));
    await updateModifierGroup('g-1', {
      name: 'Término',
      required: false,
      multi: true,
      options: [
        { id: 'o-1', name: 'Medio', extra: 0 },
        { name: 'Tres cuartos', extra: 2 },
      ],
    });
    expect(llamadas[0]).toMatchObject({
      url: '/api/backend/catalog/modifier-groups/g-1',
      init: { method: 'PATCH' },
    });
    expect(JSON.parse(String(llamadas[0].init.body))).toEqual({
      nombre: 'Término',
      obligatorio: false,
      permiteMultiple: true,
      opciones: [
        { id: 'o-1', nombre: 'Medio', precioExtra: 0 },
        { nombre: 'Tres cuartos', precioExtra: 2 },
      ],
    });

    await updateModifierGroup('g-1', {});
    expect(llamadas[1].init.body).toBe('{}');

    await deactivateModifierGroup('g-1');
    expect(llamadas[2]).toMatchObject({ url: '/api/backend/catalog/modifier-groups/g-1' });
    expect(llamadas[2].init.method).toBe('DELETE');
  });
});

describe('mutaciones de listas de precios', () => {
  it('crea, activa y borra una lista', async () => {
    enrutar(() => lista);
    const id = await createPriceList('Delivery');
    expect(id).toBe('l-1');
    expect(llamadas[0]).toMatchObject({
      url: '/api/backend/pricing/price-lists',
      init: { method: 'POST', body: JSON.stringify({ nombre: 'Delivery' }) },
    });

    enrutar(() => ({}));
    llamadas = [];
    await activatePriceList('l-1');
    expect(llamadas[0]).toMatchObject({ url: '/api/backend/pricing/price-lists/l-1/activate' });
    expect(llamadas[0].init.method).toBe('POST');

    await deletePriceList('l-1');
    expect(llamadas[1]).toMatchObject({ url: '/api/backend/pricing/price-lists/l-1' });
    expect(llamadas[1].init.method).toBe('DELETE');
  });

  it('setPrices no llama a la API si no hay ítems', async () => {
    enrutar(() => ({}));
    await setPrices('l-1', []);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('setPrices manda los importes en lote', async () => {
    enrutar(() => ({}));
    await setPrices('l-1', [
      { platoId: 'p-1', precio: 24.9 },
      { platoId: 'p-2', precio: 18 },
    ]);
    expect(llamadas[0]).toMatchObject({
      url: '/api/backend/pricing/price-lists/l-1/prices',
      init: { method: 'PUT' },
    });
    expect(llamadas[0].init.body).toBe(
      JSON.stringify({
        items: [
          { platoId: 'p-1', precio: 24.9 },
          { platoId: 'p-2', precio: 18 },
        ],
      }),
    );
  });
});
