/**
 * Contratos de combos y promociones (AYCDS-19).
 *
 * Dos reglas que no se mueven al cliente:
 *  1. **El descuento lo calcula el servidor**: el navegador manda un código,
 *     nunca un importe. `POST /promotions/coupons/:codigo/validate` devuelve el
 *     descuento sobre un subtotal y el consumo del cupón es del cobro.
 *  2. **Anti-inflación**: el `precioFijo` de un combo no puede superar la suma
 *     de sus platos a la lista activa; eso lo valida la API con `PRICING_PORT`.
 *
 * Este paquete solo aporta el vocabulario y las etiquetas que pinta la UI.
 */

export type TipoDescuentoCupon = 'PORCENTAJE' | 'MONTO';

export const TIPOS_DESCUENTO_CUPON: readonly TipoDescuentoCupon[] = [
  'PORCENTAJE',
  'MONTO',
];

export type ComboPlato = {
  platoId: string;
  cantidad: number;
  /** Nombre del plato, si la API lo trae en el `include`. */
  nombre?: string;
};

export type Combo = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precioFijo: number;
  activo: boolean;
  platos: ComboPlato[];
  /** Suma de los platos a la lista activa; `null` si falta algún precio. */
  precioReferencia: number | null;
  /** `precioReferencia - precioFijo`; `null` si no hay referencia. */
  ahorro: number | null;
  createdAt?: string;
};

export type ComboInput = {
  nombre: string;
  descripcion?: string;
  precioFijo: number;
  platos: ComboPlato[];
  activo?: boolean;
};

export type ComboUpdate = {
  nombre?: string;
  descripcion?: string;
  precioFijo?: number;
  platos?: ComboPlato[];
  activo?: boolean;
};

export type Cupon = {
  id: string;
  codigo: string;
  tipoDescuento: TipoDescuentoCupon;
  valor: number;
  limiteUsos: number;
  usosActuales: number;
  /** Día de vencimiento en Lima (`YYYY-MM-DD`). */
  vencimiento: string;
  activo: boolean;
  createdAt?: string;
};

export type CuponInput = {
  codigo: string;
  tipoDescuento: TipoDescuentoCupon;
  /** Porcentaje (0-100) o monto en soles, según el tipo. */
  valor: number;
  limiteUsos: number;
  /** Día de vencimiento en Lima (`YYYY-MM-DD`). */
  vencimiento: string;
};

export type CuponUpdate = {
  valor?: number;
  limiteUsos?: number;
  vencimiento?: string;
  activo?: boolean;
};

/** Cupón ya validado y consumido por el servidor al crear una comanda. */
export type CuponResuelto = {
  id: string;
  codigo: string;
  /** Importe descontado que calculó el servidor. */
  descuento: number;
  usosActuales: number;
  limiteUsos: number;
};

export type ReglaHoraria = {
  id: string;
  nombre: string;
  beneficio: string;
  /** Índices ISO: 1 = lunes … 7 = domingo. */
  diasSemana: number[];
  /** `HH:MM` en hora de Lima. */
  horaInicio: string;
  horaFin: string;
  activa: boolean;
  /** El servidor informa si la regla cubre el momento actual. */
  aplicaAhora: boolean;
};

export type EstadoCupon = 'VIGENTE' | 'AGOTADO' | 'VENCIDO' | 'INACTIVO';

export const ESTADOS_CUPON: readonly EstadoCupon[] = [
  'VIGENTE',
  'AGOTADO',
  'VENCIDO',
  'INACTIVO',
];

/* ------------------------------- etiquetas -------------------------------- */

export function esTipoDescuentoCupon(value: string): value is TipoDescuentoCupon {
  return (TIPOS_DESCUENTO_CUPON as readonly string[]).includes(value);
}

/**
 * Texto del beneficio para la UI. No calcula dinero: el importe descontado
 * siempre viene del servidor (`validarCupon`/`resolverCupon`).
 */
export function etiquetaDescuento(
  tipo: TipoDescuentoCupon,
  valor: number,
): string {
  if (tipo === 'PORCENTAJE') {
    return `${Number(valor.toFixed(2))}% OFF`;
  }
  return `$${valor.toFixed(2)} de descuento`;
}

/**
 * Estado de un cupón sin consultar el subtotal. Es solo presentación: el cobro
 * vuelve a validar en el servidor (activo, vencimiento y usos).
 */
export function estadoCupon(
  cupon: Pick<Cupon, 'activo' | 'usosActuales' | 'limiteUsos' | 'vencimiento'>,
  ahora: Date = new Date(),
): EstadoCupon {
  if (!cupon.activo) return 'INACTIVO';
  if (cupon.usosActuales >= cupon.limiteUsos) return 'AGOTADO';

  // El vencimiento es un día completo de Lima (UTC-05:00 fijo, sin DST).
  const fin = new Date(`${cupon.vencimiento.slice(0, 10)}T23:59:59-05:00`);
  if (Number.isFinite(fin.getTime()) && ahora.getTime() > fin.getTime()) {
    return 'VENCIDO';
  }
  return 'VIGENTE';
}

/** Ahorro de un combo frente a pedir sus platos por separado. */
export function ahorroCombo(
  precioReferencia: number | null,
  precioFijo: number,
): number | null {
  if (precioReferencia === null || !Number.isFinite(precioReferencia)) return null;
  return Math.round((precioReferencia - precioFijo) * 100) / 100;
}
