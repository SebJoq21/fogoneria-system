/**
 * Contratos de BI (AYCDS-35/45): P&L, serie diaria, ranking de platos y
 * cobros por método.
 *
 * Los reportes siempre llevan una ventana de fechas (`desde`/`hasta`, máximo
 * 366 días) en día de Lima. El servidor devuelve los importes ya agregados y
 * redondeados a 2 decimales; la web solo los pinta.
 */

export type RangoBi = {
  /** `YYYY-MM-DD` en día de Lima (inclusive). */
  desde: string;
  /** `YYYY-MM-DD` en día de Lima (inclusive). */
  hasta: string;
  /** Solo `ADMIN_GLOBAL` puede omitirla (agregado de la empresa). */
  sucursalId?: string | null;
};

export type Pnl = {
  desde: string;
  hasta: string;
  sucursalId: string | null;
  ventas: number;
  comprobado: number;
  ventaSinComprobante: number;
  gastos: number;
  margen: number;
  /** Traspaso al personal: se informa aparte porque no es ingreso. */
  propinas: number;
};

export type PnlDia = {
  fecha: string;
  ventas: number;
  gastos: number;
  margen: number;
};

export type PlatoTop = {
  platoId: string;
  sku: string | null;
  nombre: string;
  unidades: number;
  ingresos: number;
};

export type CobroMetodo = {
  metodo: string;
  cobros: number;
  monto: number;
};

export type ReporteBi<T> = {
  desde: string;
  hasta: string;
  sucursalId: string | null;
  items: T[];
};

/** Días que muestra la vista de analíticas por defecto. */
export const DIAS_VISTA_BI = 7;

/** Margen del negocio: ventas - gastos, con 2 decimales. */
export function calcularMargen(ventas: number, gastos: number): number {
  return Math.round((ventas - gastos + Number.EPSILON) * 100) / 100;
}

const ETIQUETAS_METODO: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
  YAPE: 'Yape',
  PLIN: 'Plin',
};

/** Etiqueta legible del método de pago; un valor desconocido se muestra tal cual. */
export function etiquetaMetodoPago(metodo: string): string {
  const clave = metodo.trim().toUpperCase();
  if (!clave) return 'Sin método';
  return ETIQUETAS_METODO[clave] ?? metodo;
}
