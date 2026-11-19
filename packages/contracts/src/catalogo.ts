/**
 * Contratos de catálogo y precios.
 *
 * Vocabulario único del módulo: la API responde snake_case (`categoria_id`,
 * `precio_extra`…) y el ERP del web guarda tipos propios (`lib/erp-catalog.ts`).
 * Los mapeos viven en `apps/web/features/catalogo/api.ts` (API → contrato) y en
 * `apps/web/features/catalogo/hooks.ts` (contrato ↔ estado del ERP).
 *
 * El precio nunca es parte del plato: vive en una lista de precios.
 */

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

export type ListaPrecio = {
  id: string;
  nombre: string;
  activa: boolean;
  /** ISO de vigencia (`YYYY-MM-DD`); vacío si no tiene. */
  vigenciaDesde: string;
  vigenciaHasta: string;
  /** `platoId` → precio en esta lista. */
  precios: Record<string, number>;
};

export type PrecioPlato = {
  listaId: string;
  platoId: string;
  precio: number;
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
  /** Precio en la lista activa (el que se edita desde el maestro). */
  precio: number;
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

export type PrecioInput = {
  listaId: string;
  platoId: string;
  precio: number;
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

/** El precio del servidor es un decimal no negativo. */
export function validarPrecio(precio: number): string | null {
  if (!Number.isFinite(precio)) return 'Precio inválido';
  if (precio < 0) return 'El precio no puede ser negativo';
  return null;
}

/* -------------------------------- etiquetas ------------------------------- */

export function estadoPlato(activo: boolean): EstadoPlato {
  return activo ? 'Activo' : 'Inactivo';
}

/** Importe para la UI, en la moneda del ERP (`$24.90`). */
export function formatearPrecio(precio: number): string {
  return `$${precio.toFixed(2)}`;
}

/** Precio de un plato en la lista activa (o en la primera si no hay activa). */
export function precioEnListaActiva(listas: ListaPrecio[], platoId: string): number {
  const activa = listas.find((l) => l.activa) ?? listas[0];
  return activa?.precios[platoId] ?? 0;
}

export function nombreDeCategoria(categorias: Categoria[], categoriaId: string): string {
  return categorias.find((c) => c.id === categoriaId)?.nombre ?? '—';
}
