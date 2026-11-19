/**
 * Contratos de órdenes y del tablero del KDS.
 *
 * Dos formas conviven a propósito:
 * - `BoardOrden` / `TableroOrdenes`: lo que devuelve `GET /orders/board`
 *   (camelCase, ya calculado por el servidor con SLA y métricas).
 * - `OrdenKds` / `TableroKds`: el modelo de presentación de las columnas.
 *
 * La regla de urgencia vive en la web (`lib/order-mapping.ts`: ámbar >10 min,
 * rojo >20); aquí solo van estados, etiquetas y la base del reloj.
 */

export type EstadoOrden =
  | 'POR_CONFIRMAR'
  | 'EN_COCINA'
  | 'LISTO'
  | 'ENTREGADO'
  | 'PAGADA'
  | 'CERRADA'
  | 'ANULADA';

/** Estados del KDS. `anulado` no tiene columna: la comanda se retira del tablero. */
export type EstadoKds = 'pendiente' | 'cocina' | 'listo' | 'entregado' | 'anulado';

export type CanalOrden = 'Mesa' | 'Llevar' | 'Web';

export type OrigenOrden = 'MESA' | 'BARRA' | 'DELIVERY' | 'MOSTRADOR' | 'WEB';

export type MetricasTablero = {
  abiertas: number;
  fueraDeSla: number;
  promedioEsperaMin: number | null;
  promedioPreparacionMin: number | null;
};

/** Comanda tal como viaja en el tablero de la API. */
export type BoardOrden = {
  id: string;
  numeroOrden: string;
  estado: EstadoOrden;
  origen: OrigenOrden | string;
  sucursalId: string;
  mesaId: string | null;
  mesa: { id: string; numero: string } | null;
  mesero: string | null;
  total: number;
  items: number;
  ingresoAt: string;
  confirmacionAt: string | null;
  listoAt: string | null;
  /** Minutos desde la base del SLA. `null` si ya se entregó. */
  minutos: number | null;
  alertaSla: boolean;
  excedidoPor: number | null;
};

export type ColumnaBoard = {
  estado: EstadoOrden;
  total: number;
  ordenes: BoardOrden[];
};

/** Respuesta de `GET /orders/board` (una sola llamada). */
export type TableroOrdenes = {
  generadoAt: string;
  slaMinutos: number;
  ventanaDias: number;
  limite: number;
  truncado: boolean;
  columnas: ColumnaBoard[];
  metricas: MetricasTablero;
};

/** Comanda de una columna del KDS (modelo de presentación). */
export type OrdenKds = {
  /** Folio visible (`ORD-000123`). */
  id: string;
  apiId: string;
  status: EstadoKds;
  customer: string;
  channel: CanalOrden;
  waiter?: string;
  amount: number;
  items: number;
  createdAt: string;
  /** Base del reloj de SLA: confirmación o, si no la hay, ingreso. */
  slaBaseAt: string;
  alertaSla: boolean;
  excedidoPor: number | null;
  mesa: { id: string; numero: string } | null;
};

export type ColumnaKds = {
  status: EstadoKds;
  label: string;
  orders: OrdenKds[];
};

export type TableroKds = {
  columns: ColumnaKds[];
  slaMinutos: number;
  truncado: boolean;
  generadoAt: string;
  metricas: MetricasTablero;
};

export type ModoKds = 'ordenes' | 'cocina';

export const ESTADOS_ORDEN: readonly EstadoOrden[] = [
  'POR_CONFIRMAR',
  'EN_COCINA',
  'LISTO',
  'ENTREGADO',
  'PAGADA',
  'CERRADA',
  'ANULADA',
];

/** Columnas del KDS, en el orden en que se pintan. */
export const COLUMNAS_KDS: readonly { status: EstadoKds; label: string }[] = [
  { status: 'pendiente', label: 'Por confirmar' },
  { status: 'cocina', label: 'En cocina' },
  { status: 'listo', label: 'Listo' },
  { status: 'entregado', label: 'Entregado' },
];

export function isEstadoOrden(value: string): value is EstadoOrden {
  return (ESTADOS_ORDEN as readonly string[]).includes(value);
}

/** Estado de la API → columna del KDS. */
export function estadoKdsDeApi(estado: EstadoOrden): EstadoKds {
  switch (estado) {
    case 'EN_COCINA':
      return 'cocina';
    case 'LISTO':
      return 'listo';
    case 'ENTREGADO':
    case 'PAGADA':
    case 'CERRADA':
      return 'entregado';
    case 'ANULADA':
      return 'anulado';
    case 'POR_CONFIRMAR':
    default:
      return 'pendiente';
  }
}

/** Origen de la comanda → canal visible. */
export function canalDeOrigen(origen: OrigenOrden | string): CanalOrden {
  switch (origen) {
    case 'MESA':
      return 'Mesa';
    case 'BARRA':
    case 'MOSTRADOR':
      return 'Llevar';
    default:
      return 'Web';
  }
}

/** Base del reloj de SLA: la confirmación manda; si no, el ingreso. */
export function slaBaseDe(orden: { confirmacionAt?: string | null; ingresoAt: string }): string {
  return orden.confirmacionAt ?? orden.ingresoAt;
}

/** Una comanda abierta aún no llegó a un estado terminal. */
export function esOrdenAbierta(estado: EstadoOrden): boolean {
  return estado !== 'PAGADA' && estado !== 'CERRADA' && estado !== 'ANULADA';
}

/** Etiqueta de la columna del KDS. */
export function etiquetaEstadoKds(estado: EstadoKds): string {
  if (estado === 'anulado') return 'Anulada';
  return COLUMNAS_KDS.find((columna) => columna.status === estado)?.label ?? 'Por confirmar';
}
