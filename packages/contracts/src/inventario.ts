/**
 * Contratos de inventario (semáforo de stock y kardex).
 *
 * La API ya responde camelCase en `/inventory/stock` y `/inventory/movements`,
 * así que el contrato es la forma que consume la UI. El estado del stock lo
 * calcula la base (`v_stock_bajo`); aquí solo se etiqueta y se resume.
 *
 * El consumo por escandallo (AYCDS-11) ocurre al pasar una comanda a
 * `ENTREGADO`: se descuenta la receta, nunca se edita el stock a mano desde la
 * web sin un movimiento que lo respalde.
 */

export type EstadoStock = 'AGOTADO' | 'BAJO' | 'OPTIMO';

export const ESTADOS_STOCK: readonly EstadoStock[] = ['AGOTADO', 'BAJO', 'OPTIMO'];

export type InsumoStock = {
  sucursalId: string;
  insumoId: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  stockMinimo: number;
  estado: EstadoStock;
};

export type ResumenStock = {
  total: number;
  agotados: number;
  bajos: number;
  optimos: number;
};

export type EstadoStockSucursal = {
  sucursalId: string | null;
  resumen: ResumenStock;
  items: InsumoStock[];
};

export type TipoMovimientoInventario = 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'MERMA';

export const TIPOS_MOVIMIENTO_INVENTARIO: readonly TipoMovimientoInventario[] = [
  'ENTRADA',
  'SALIDA',
  'AJUSTE',
  'MERMA',
];

export type MovimientoInventario = {
  id: string;
  /** ISO de la API; la UI lo pinta en hora local. */
  fecha: string;
  tipo: TipoMovimientoInventario;
  insumoId: string;
  insumo: string;
  unidad: string;
  cantidad: number;
  /** Stock después del movimiento; `null` si la API no lo calculó. */
  stockResultante: number | null;
  motivo: string | null;
  /** Folio de la comanda que originó la salida, si aplica. */
  orden: string | null;
};

export type FiltroMovimientos = {
  sucursalId?: string;
  insumoId?: string;
  tipo?: TipoMovimientoInventario;
  /** Día de Lima en `YYYY-MM-DD`. */
  desde?: string;
  /** Día de Lima en `YYYY-MM-DD` (incluido). */
  hasta?: string;
  /** La API acota a 500; sin límite devuelve 100. */
  limit?: number;
};

/**
 * Resultado del descuento por escandallo al entregar una comanda.
 * Es idempotente por orden: repetir la entrega no vuelve a descontar.
 */
export type ConsumoResultado = {
  /** `false` si la orden ya se había consumido o no tenía receta. */
  aplicado: boolean;
  /** Insumos con movimiento de salida. */
  insumos: number;
  /** Líneas de la comanda (platos) consideradas. */
  lineas: number;
  /** Platos sin escandallo: se omiten y no bloquean la entrega. */
  sinReceta: string[];
};

/* ------------------------------- etiquetas -------------------------------- */

export function esEstadoStock(value: string): value is EstadoStock {
  return (ESTADOS_STOCK as readonly string[]).includes(value);
}

export function esTipoMovimientoInventario(
  value: string,
): value is TipoMovimientoInventario {
  return (TIPOS_MOVIMIENTO_INVENTARIO as readonly string[]).includes(value);
}

export function etiquetaEstadoStock(estado: EstadoStock): 'Agotado' | 'Bajo' | 'Óptimo' {
  switch (estado) {
    case 'AGOTADO':
      return 'Agotado';
    case 'BAJO':
      return 'Bajo';
    default:
      return 'Óptimo';
  }
}

/** Etiqueta del kardex para la UI. */
export function etiquetaTipoMovimiento(
  tipo: TipoMovimientoInventario | string,
): 'Entrada' | 'Salida' | 'Ajuste' | 'Merma' {
  switch (tipo) {
    case 'ENTRADA':
      return 'Entrada';
    case 'SALIDA':
      return 'Salida';
    case 'MERMA':
      return 'Merma';
    default:
      return 'Ajuste';
  }
}

/** Signo y unidad que ve el almacenero: `-2.5 kg`, `+4 kg`, `0.5 kg`. */
export function movimientoCantidadLabel(
  movimiento: Pick<MovimientoInventario, 'tipo' | 'cantidad' | 'unidad'>,
): string {
  const valor = Number(movimiento.cantidad ?? 0);
  const simbolo =
    movimiento.tipo === 'ENTRADA' ? '+' : movimiento.tipo === 'AJUSTE' ? '' : '-';
  return `${simbolo}${valor} ${movimiento.unidad}`.trim();
}

/** Cuenta el semáforo desde los insumos (respaldo del `resumen` de la API). */
export function resumenStock(items: readonly Pick<InsumoStock, 'estado'>[]): ResumenStock {
  return {
    total: items.length,
    agotados: items.filter((item) => item.estado === 'AGOTADO').length,
    bajos: items.filter((item) => item.estado === 'BAJO').length,
    optimos: items.filter((item) => item.estado === 'OPTIMO').length,
  };
}
