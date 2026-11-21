/**
 * Contratos de catálogo (categorías, platos y modificadores).
 *
 * El **precio nunca es parte del plato**: vive en una lista de precios y se
 * consume por `@fogoneria/contracts/pricing`.
 *
 * La API responde snake_case (`categoria_id`, `precio_extra`…) y el ERP del web
 * guarda tipos propios (`lib/erp-catalog.ts`). Los mapeos viven en
 * `apps/web/features/catalog/api.ts` y `apps/web/features/catalog/hooks.ts`.
 */

import type { ListaPrecio } from './pricing';

export type EstadoPlato = 'Activo' | 'Inactivo';

export type Categoria = {
  id: string;
  nombre: string;
  posicion: number;
};

export type OpcionModificador = {
  id: string;
  nombre: string;
  extra: number;
};

export type GrupoModificador = {
  id: string;
  nombre: string;
  obligatorio: boolean;
  multiple: boolean;
  opciones: OpcionModificador[];
};

export type Plato = {
  id: string;
  sku: string;
  nombre: string;
  descripcion: string;
  categoriaId: string;
  imagen: string;
  estado: EstadoPlato;
  /** Grupos de modificadores asignados al plato. */
  grupoIds: string[];
};

/** Foto completa del catálogo de una empresa (sin datos por sucursal). */
export type Catalogo = {
  categorias: Categoria[];
  platos: Plato[];
  grupos: GrupoModificador[];
  listas: ListaPrecio[];
};

/* ------------------------------- entradas -------------------------------- */

export type PlatoInput = {
  /** Sin `id` es alta; con `id`, edición. */
  id?: string;
  nombre: string;
  descripcion: string;
  categoriaId: string;
  imagen: string;
  activo: boolean;
  grupoIds: string[];
};

export type CategoriaInput = {
  id?: string;
  nombre: string;
  posicion: number;
};

export type GrupoModificadorInput = {
  nombre: string;
  obligatorio: boolean;
  multiple: boolean;
};

export type OpcionModificadorInput = {
  /** Conservarlo al editar: la API sincroniza por id y borra lo que no viaje. */
  id?: string;
  nombre: string;
  extra: number;
};

export type GrupoModificadorUpdate = {
  nombre?: string;
  obligatorio?: boolean;
  multiple?: boolean;
  opciones?: OpcionModificadorInput[];
};

/* ------------------------------- validación ------------------------------- */

/** Devuelve el mensaje de error o `null` si el plato es válido. */
export function validarPlato(input: { nombre?: string; categoriaId?: string }): string | null {
  if (!input.nombre || !input.nombre.trim()) return 'Falta el nombre del plato';
  if (!input.categoriaId || !input.categoriaId.trim()) return 'Elige una categoría';
  return null;
}

/** Devuelve el mensaje de error o `null` si la categoría es válida. */
export function validarCategoria(input: { nombre?: string }): string | null {
  if (!input.nombre || !input.nombre.trim()) return 'Falta el nombre de la categoría';
  return null;
}

/** Devuelve el mensaje de error o `null` si el grupo es válido. */
export function validarGrupoModificador(input: { nombre?: string }): string | null {
  if (!input.nombre || !input.nombre.trim()) return 'Falta el nombre del grupo';
  return null;
}

/* -------------------------------- etiquetas ------------------------------- */

export function estadoPlato(activo: boolean): EstadoPlato {
  return activo ? 'Activo' : 'Inactivo';
}

export function nombreDeCategoria(categorias: Categoria[], categoriaId: string): string {
  return categorias.find((c) => c.id === categoriaId)?.nombre ?? '—';
}
