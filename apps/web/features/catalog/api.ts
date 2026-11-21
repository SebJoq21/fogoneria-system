/**
 * Cliente del módulo Catálogo (categorías, platos y modificadores).
 *
 * Habla con el BFF (`/api/backend`) a través del SDK compartido: el navegador
 * nunca conoce la URL de la API ni el token. Este cliente **solo lee**: las
 * mutaciones pasan por las acciones de `CatalogoProvider` (que usa
 * `lib/catalog-api.ts`) porque el ERP entero comparte ese estado.
 *
 * La API responde snake_case; aquí se traduce al contrato
 * (`@fogoneria/contracts/catalog`). El precio vive en `features/pricing`.
 */

import { createClient, queryString } from '@fogoneria/sdk';
import type {
  Categoria,
  GrupoModificador,
  Plato,
} from '@fogoneria/contracts/catalog';

export const catalogClient = createClient({ baseUrl: '/api/backend' });

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

async function listarTodosLosPlatos(signal?: AbortSignal): Promise<ApiPlato[]> {
  const primera = await catalogClient.get<ApiPaginaPlatos>(
    `/catalog/dishes${queryString({ limit: TAMANO_PAGINA, page: 1 })}`,
    { signal },
  );
  const platos = [...primera.items];
  const paginas = Math.ceil(primera.total / TAMANO_PAGINA);
  for (let pagina = 2; pagina <= paginas; pagina += 1) {
    const siguiente = await catalogClient.get<ApiPaginaPlatos>(
      `/catalog/dishes${queryString({ limit: TAMANO_PAGINA, page: pagina })}`,
      { signal },
    );
    platos.push(...siguiente.items);
  }
  return platos;
}

export const catalogApi = {
  async listCategorias({ signal }: { signal?: AbortSignal } = {}): Promise<Categoria[]> {
    const raw = await catalogClient.get<ApiCategoria[]>('/catalog/categories', { signal });
    return raw.map(toCategoria);
  },

  async listPlatos({ signal }: { signal?: AbortSignal } = {}): Promise<Plato[]> {
    const raw = await listarTodosLosPlatos(signal);
    return raw.map(toPlato);
  },

  async listGruposModificadores({
    signal,
  }: { signal?: AbortSignal } = {}): Promise<GrupoModificador[]> {
    const raw = await catalogClient.get<ApiGrupoModificador[]>('/catalog/modifier-groups', {
      signal,
    });
    return raw.map(toGrupoModificador);
  },
};
