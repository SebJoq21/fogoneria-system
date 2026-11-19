/**
 * Cliente del módulo Catálogo y Precios.
 *
 * Habla con el BFF (`/api/backend`) a través del SDK compartido: el navegador
 * nunca conoce la URL de la API ni el token. Este cliente **solo lee**: las
 * mutaciones pasan por las acciones de `ModulesProvider` (`saveProduct`,
 * `setPrice`…) porque el ERP entero comparte ese estado (carta, mesero, caja) y
 * escribir desde aquí dejaría dos fuentes de verdad. La escritura propia llega
 * con la ola de órdenes (`PricingPort`).
 *
 * La API responde snake_case; aquí se traduce al contrato (`@fogoneria/contracts/catalogo`).
 */

import { createClient } from '@fogoneria/sdk';
import type {
  Categoria,
  Catalogo,
  GrupoModificador,
  ListaPrecio,
  Plato,
  PrecioPlato,
} from '@fogoneria/contracts/catalogo';

export const catalogoClient = createClient({ baseUrl: '/api/backend' });

/** Los decimales de Prisma llegan como string. */
const numero = (valor: string | number | null | undefined): number => Number(valor ?? 0) || 0;

export const IMAGEN_PLATO_POR_DEFECTO =
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';

type ApiCategoria = {
  id: string;
  nombre: string;
  posicion: number;
};

type ApiPlato = {
  id: string;
  categoria_id: string;
  sku: string;
  nombre: string;
  descripcion: string | null;
  foto_url: string | null;
  activo: boolean;
  platos_grupos_modificadores?: { grupo_id: string }[];
};

type ApiOpcionModificador = {
  id: string;
  nombre: string;
  precio_extra: string | number;
};

type ApiGrupoModificador = {
  id: string;
  nombre: string;
  obligatorio: boolean;
  permite_multiple: boolean;
  opciones_modificadores: ApiOpcionModificador[];
};

type ApiListaPrecio = {
  id: string;
  nombre: string;
  activa: boolean;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
};

type ApiPrecio = {
  lista_id: string;
  plato_id: string;
  precio: string | number;
};

type ApiPaginaPlatos = {
  items: ApiPlato[];
  total: number;
  page: number;
  limit: number;
};

/** Tope de `limit` en la API: se pagina hasta traer toda la carta. */
const TAMANO_PAGINA = 100;

export function toCategoria(raw: ApiCategoria): Categoria {
  return { id: raw.id, nombre: raw.nombre, posicion: raw.posicion };
}

export function toPlato(raw: ApiPlato): Plato {
  return {
    id: raw.id,
    sku: raw.sku,
    nombre: raw.nombre,
    descripcion: raw.descripcion ?? '',
    categoriaId: raw.categoria_id,
    imagen: raw.foto_url || IMAGEN_PLATO_POR_DEFECTO,
    estado: raw.activo ? 'Activo' : 'Inactivo',
    grupoIds: (raw.platos_grupos_modificadores ?? []).map((g) => g.grupo_id),
  };
}

export function toGrupoModificador(raw: ApiGrupoModificador): GrupoModificador {
  return {
    id: raw.id,
    nombre: raw.nombre,
    obligatorio: raw.obligatorio,
    multiple: raw.permite_multiple,
    opciones: raw.opciones_modificadores.map((o) => ({
      id: o.id,
      nombre: o.nombre,
      extra: numero(o.precio_extra),
    })),
  };
}

export function toListaPrecio(raw: ApiListaPrecio, precios: Record<string, number>): ListaPrecio {
  return {
    id: raw.id,
    nombre: raw.nombre,
    activa: raw.activa,
    vigenciaDesde: raw.vigencia_desde?.slice(0, 10) ?? '',
    vigenciaHasta: raw.vigencia_hasta?.slice(0, 10) ?? '',
    precios,
  };
}

export function toPrecioPlato(raw: ApiPrecio): PrecioPlato {
  return { listaId: raw.lista_id, platoId: raw.plato_id, precio: numero(raw.precio) };
}

async function listarTodosLosPlatos(signal?: AbortSignal): Promise<ApiPlato[]> {
  const primera = await catalogoClient.get<ApiPaginaPlatos>(
    `/catalog/dishes?limit=${TAMANO_PAGINA}&page=1`,
    { signal },
  );
  const platos = [...primera.items];
  const paginas = Math.ceil(primera.total / TAMANO_PAGINA);
  for (let pagina = 2; pagina <= paginas; pagina += 1) {
    const siguiente = await catalogoClient.get<ApiPaginaPlatos>(
      `/catalog/dishes?limit=${TAMANO_PAGINA}&page=${pagina}`,
      { signal },
    );
    platos.push(...siguiente.items);
  }
  return platos;
}

export const catalogoApi = {
  async listCategorias({ signal }: { signal?: AbortSignal } = {}): Promise<Categoria[]> {
    const raw = await catalogoClient.get<ApiCategoria[]>('/catalog/categories', { signal });
    return raw.map(toCategoria);
  },

  async listPlatos({ signal }: { signal?: AbortSignal } = {}): Promise<Plato[]> {
    const raw = await listarTodosLosPlatos(signal);
    return raw.map(toPlato);
  },

  async listGruposModificadores({
    signal,
  }: { signal?: AbortSignal } = {}): Promise<GrupoModificador[]> {
    const raw = await catalogoClient.get<ApiGrupoModificador[]>('/catalog/modifier-groups', {
      signal,
    });
    return raw.map(toGrupoModificador);
  },

  async listPrecios(
    listaId: string,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<PrecioPlato[]> {
    const raw = await catalogoClient.get<ApiPrecio[]>(
      `/pricing/price-lists/${listaId}/prices`,
      { signal },
    );
    return raw.map(toPrecioPlato);
  },

  /** Maestros + precios de todas las listas en una sola foto. */
  async snapshot({ signal }: { signal?: AbortSignal } = {}): Promise<Catalogo> {
    const [categorias, platos, grupos, listas] = await Promise.all([
      catalogoClient.get<ApiCategoria[]>('/catalog/categories', { signal }),
      listarTodosLosPlatos(signal),
      catalogoClient.get<ApiGrupoModificador[]>('/catalog/modifier-groups', { signal }),
      catalogoClient.get<ApiListaPrecio[]>('/pricing/price-lists', { signal }),
    ]);

    const conPrecios = await Promise.all(
      listas.map(async (lista) => {
        const filas = await catalogoClient.get<ApiPrecio[]>(
          `/pricing/price-lists/${lista.id}/prices`,
          { signal },
        );
        const precios: Record<string, number> = {};
        for (const fila of filas) precios[fila.plato_id] = numero(fila.precio);
        return toListaPrecio(lista, precios);
      }),
    );

    return {
      categorias: categorias.map(toCategoria),
      platos: platos.map(toPlato),
      grupos: grupos.map(toGrupoModificador),
      listas: conPrecios,
    };
  },
};
