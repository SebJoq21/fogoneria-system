/**
 * Contratos de gastos y cuentas por pagar (AYCDS-17).
 *
 * Regla de oro: **un gasto pagado en efectivo sale de la caja**. Con tarjeta,
 * transferencia o Yape solo cambia el estado, porque el banco no está en el
 * cajón. Un gasto pagado en caja no se edita ni se borra: se compensa.
 */

import type { MetodoPago } from './cash';

export type EstadoPago = 'PENDIENTE' | 'PAGADO';

export type CategoriaGasto =
  | 'INSUMOS'
  | 'SERVICIOS'
  | 'PERSONAL'
  | 'ALQUILER'
  | 'MARKETING'
  | 'OTROS';

export type Gasto = {
  id: string;
  sucursalId: string;
  concepto: string;
  monto: number;
  categoria: CategoriaGasto;
  estadoPago: EstadoPago;
  /** `true` si el egreso ya entró al turno de caja. */
  pagadoEnCaja: boolean;
  turnoId: string | null;
  proveedorId: string | null;
  /** Nombre del proveedor, si la API lo trae en el `include`. */
  proveedor: string | null;
  /** Vencimiento en día de Lima (`YYYY-MM-DD`). */
  vencimiento: string | null;
  registradoPor: string | null;
  createdAt: string;
};

export type GastoInput = {
  concepto: string;
  monto: number;
  categoria: CategoriaGasto;
  /** Solo `ADMIN_GLOBAL`: los demás heredan la sucursal del token. */
  sucursalId?: string;
  proveedorId?: string;
  /** Vencimiento en día de Lima (`YYYY-MM-DD`). */
  vencimiento?: string;
};

export type PagoGastoInput = {
  metodo: MetodoPago;
};

export const ESTADOS_PAGO: readonly EstadoPago[] = ['PENDIENTE', 'PAGADO'];

export const CATEGORIAS_GASTO: readonly CategoriaGasto[] = [
  'INSUMOS',
  'SERVICIOS',
  'PERSONAL',
  'ALQUILER',
  'MARKETING',
  'OTROS',
];

export function esEstadoPago(value: string): value is EstadoPago {
  return (ESTADOS_PAGO as readonly string[]).includes(value);
}

export function esCategoriaGasto(value: string): value is CategoriaGasto {
  return (CATEGORIAS_GASTO as readonly string[]).includes(value);
}

/** Pagar en efectivo exige turno abierto y deja el egreso en caja. */
export function pagoSaleDeCaja(metodo: MetodoPago): boolean {
  return metodo === 'EFECTIVO';
}

/** Devuelve el mensaje de error o `null` si el gasto es válido. */
export function validarGasto(input: {
  concepto?: string;
  monto?: number;
  categoria?: string;
}): string | null {
  if (!input.concepto || !input.concepto.trim()) return 'Falta el concepto del gasto';
  if (input.concepto.trim().length > 200) return 'El concepto admite hasta 200 caracteres';
  if (!Number.isFinite(input.monto) || (input.monto ?? 0) <= 0) {
    return 'El monto debe ser mayor a cero';
  }
  if (!input.categoria || !esCategoriaGasto(input.categoria)) {
    return 'Categoría de gasto inválida';
  }
  return null;
}

/** Etiqueta de la categoría para la UI. */
export function etiquetaCategoria(categoria: CategoriaGasto): string {
  switch (categoria) {
    case 'SERVICIOS':
      return 'Servicios';
    case 'PERSONAL':
      return 'Personal';
    case 'ALQUILER':
      return 'Alquiler';
    case 'MARKETING':
      return 'Marketing';
    case 'OTROS':
      return 'Otros';
    default:
      return 'Insumos';
  }
}

export function etiquetaEstadoPago(estado: EstadoPago): string {
  return estado === 'PAGADO' ? 'Pagado' : 'Pendiente';
}
