/**
 * Contratos de caja (turnos, movimientos, arqueo y cobro).
 *
 * La API responde snake_case (`fondo_apertura`, `turno_id`…); el mapeo vive en
 * `apps/web/features/cash/api.ts`. Aquí solo van las formas del dominio, los
 * validadores y las etiquetas que comparten las pantallas.
 *
 * Reglas que el contrato no relaja:
 * - `PAGADA` no se escribe desde órdenes: se cobra con `POST /cash/charges`.
 * - Una sucursal tiene un solo turno `ABIERTO` (índice único en la base).
 * - Los totales del turno los calcula el servidor desde los movimientos.
 */

export type EstadoTurno = 'ABIERTO' | 'CERRADO';

export type TipoMovimiento = 'INGRESO' | 'EGRESO';

export type MetodoPago = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'YAPE';

export type TurnoCaja = {
  id: string;
  sucursalId: string;
  cajeroId: string | null;
  /** Nombre del cajero, si la API lo trae en el `include`. */
  cajero: string | null;
  aperturaAt: string;
  cierreAt: string | null;
  fondoApertura: number;
  ingresosTotal: number;
  egresosTotal: number;
  saldo: number | null;
  efectivoContado: number | null;
  diferencia: number | null;
  observaciones: string | null;
  estado: EstadoTurno;
};

export type MovimientoCaja = {
  id: string;
  turnoId: string;
  tipo: TipoMovimiento;
  concepto: string;
  monto: number;
  metodo: MetodoPago;
  /** Comanda cobrada, si el movimiento nació de un cobro. */
  ordenId: string | null;
  /** Gasto pagado en caja, si el egreso es de AYCDS-17. */
  gastoId: string | null;
  /** Nombre de quien registró el movimiento. */
  actor: string | null;
  createdAt: string;
};

/** Arqueo del turno tal como lo devuelve el servidor. */
export type Arqueo = {
  fondo: number;
  ingresos: number;
  egresos: number;
  ingresosEfectivo: number;
  egresosEfectivo: number;
  esperadoEfectivo: number;
  saldoSistema: number;
  movimientos: number;
  efectivoContado: number | null;
  diferencia: number | null;
};

/** Turno abierto con su arqueo; `null` si la sucursal no tiene caja abierta. */
export type TurnoCajaActual = { turno: TurnoCaja; arqueo: Arqueo } | null;

export type AperturaInput = {
  fondoApertura: number;
  /** Solo `ADMIN_GLOBAL`: los roles operativos la heredan del token. */
  sucursalId?: string;
};

export type CierreInput = {
  efectivoContado: number;
  observaciones?: string;
};

export type MovimientoInput = {
  tipo: TipoMovimiento;
  concepto: string;
  monto: number;
  metodo: MetodoPago;
  sucursalId?: string;
};

/** Cobro de una comanda: admite pago parcial y propina. */
export type CobroInput = {
  ordenId: string;
  metodo: MetodoPago;
  /** Sin `monto`, el servidor cobra todo el saldo pendiente. */
  monto?: number;
  propina?: number;
};

export type ResultadoCobro = {
  ordenId: string;
  numeroOrden: string;
  turnoId: string;
  cobrado: number;
  propina: number;
  total: number;
  pendiente: number;
  pagada: boolean;
};

export const ESTADOS_TURNO: readonly EstadoTurno[] = ['ABIERTO', 'CERRADO'];

export const TIPOS_MOVIMIENTO: readonly TipoMovimiento[] = ['INGRESO', 'EGRESO'];

export const METODOS_PAGO: readonly MetodoPago[] = [
  'EFECTIVO',
  'TARJETA',
  'TRANSFERENCIA',
  'YAPE',
];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function esEstadoTurno(value: string): value is EstadoTurno {
  return (ESTADOS_TURNO as readonly string[]).includes(value);
}

export function esTipoMovimiento(value: string): value is TipoMovimiento {
  return (TIPOS_MOVIMIENTO as readonly string[]).includes(value);
}

export function esMetodoPago(value: string): value is MetodoPago {
  return (METODOS_PAGO as readonly string[]).includes(value);
}

/** Devuelve el mensaje de error o `null` si el cobro es válido. */
export function validarCobro(input: {
  ordenId?: string;
  metodo?: string;
  monto?: number;
  propina?: number;
}): string | null {
  if (!input.ordenId || !input.ordenId.trim()) return 'Falta la comanda a cobrar';
  if (!input.metodo || !esMetodoPago(input.metodo)) return 'Método de pago inválido';
  if (input.monto !== undefined && !(input.monto > 0)) return 'El monto debe ser mayor a cero';
  if (input.propina !== undefined && input.propina < 0) return 'La propina no puede ser negativa';
  return null;
}

/** Devuelve el mensaje de error o `null` si el movimiento manual es válido. */
export function validarMovimiento(input: {
  tipo?: string;
  concepto?: string;
  monto?: number;
  metodo?: string;
}): string | null {
  if (!input.tipo || !esTipoMovimiento(input.tipo)) return 'Tipo de movimiento inválido';
  if (!input.concepto || !input.concepto.trim()) return 'Falta el concepto';
  if (!Number.isFinite(input.monto) || (input.monto ?? 0) <= 0) {
    return 'El monto debe ser mayor a cero';
  }
  if (!input.metodo || !esMetodoPago(input.metodo)) return 'Método de pago inválido';
  return null;
}

/** `contado - esperado` con 2 decimales: el descuadre del arqueo. */
export function diferenciaDeArqueo(contado: number, esperado: number): number {
  return round2(contado - esperado);
}

/** Etiqueta del método para la UI. */
export function etiquetaMetodo(metodo: MetodoPago): string {
  switch (metodo) {
    case 'TARJETA':
      return 'Tarjeta';
    case 'TRANSFERENCIA':
      return 'Transferencia';
    case 'YAPE':
      return 'Yape';
    default:
      return 'Efectivo';
  }
}

/** Etiqueta de la UI (`Efectivo`, `Yape`…) al enum de la API. */
export function metodoDeEtiqueta(label: string): MetodoPago {
  switch (label.trim().toLowerCase()) {
    case 'tarjeta':
      return 'TARJETA';
    case 'yape':
    case 'plin':
      return 'YAPE';
    case 'transferencia':
      return 'TRANSFERENCIA';
    default:
      return 'EFECTIVO';
  }
}

export function etiquetaTipoMovimiento(tipo: TipoMovimiento): 'Ingreso' | 'Egreso' {
  return tipo === 'INGRESO' ? 'Ingreso' : 'Egreso';
}

export function etiquetaEstadoTurno(estado: EstadoTurno): string {
  return estado === 'ABIERTO' ? 'Abierto' : 'Cerrado';
}
