/**
 * Contratos de precios (listas y precios por plato).
 *
 * El precio no vive en el plato: cada lista (`Carta`, `Delivery`, `Eventos`)
 * guarda su propio mapa `platoId → precio`. La lista activa es la que pinta la
 * carta virtual y la que usa el POS cuando no se indica otra.
 */

import type { PlatoInput } from './catalog';

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

export type PrecioInput = {
  listaId: string;
  platoId: string;
  precio: number;
};

/** Alta/edición de un plato junto con su precio en la lista activa. */
export type PlatoPrecioInput = {
  plato: PlatoInput;
  precio: number;
};

/** El precio del servidor es un decimal no negativo. */
export function validarPrecio(precio: number): string | null {
  if (!Number.isFinite(precio)) return 'Precio inválido';
  if (precio < 0) return 'El precio no puede ser negativo';
  return null;
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
