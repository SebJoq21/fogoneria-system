import type { estado_orden } from '../../generated/prisma/enums.js';

/**
 * SLA de preparación del KDS (AYCDS-30).
 *
 * La comanda empieza a contar cuando la cocina la confirma (`confirmacion_at`)
 * y, si todavía no la confirmó, desde que entró (`ingreso_at`). A los 20
 * minutos se marca la alerta; entregada la comanda el reloj se detiene.
 */
export const SLA_MINUTOS = 20;

/** Columnas del tablero, en el orden en que las pinta el KDS. */
export const BOARD_STATES: readonly estado_orden[] = [
  'POR_CONFIRMAR',
  'EN_COCINA',
  'LISTO',
  'ENTREGADO',
];

/** Estados en los que el reloj del SLA sigue corriendo. */
export const SLA_STATES: readonly estado_orden[] = [
  'POR_CONFIRMAR',
  'EN_COCINA',
  'LISTO',
];

export const BOARD_DIAS = 7;
export const BOARD_LIMITE = 200;
export const BOARD_LIMITE_MAX = 500;
export const BOARD_DIAS_MAX = 30;

const MINUTO_MS = 60_000;
const DIA_MS = 24 * 60 * MINUTO_MS;

export interface SlaRow {
  estado: estado_orden;
  ingreso_at: Date;
  confirmacion_at: Date | null;
}

export interface SlaInfo {
  /** Minutos desde la confirmación (o desde el ingreso si no se confirmó). */
  minutos: number | null;
  alertaSla: boolean;
  /** Minutos de más sobre el SLA; `null` si va en tiempo o ya se entregó. */
  excedidoPor: number | null;
}

/** Base del reloj: la confirmación manda, el ingreso es el respaldo. */
export function slaBase(orden: SlaRow): Date {
  return orden.confirmacion_at ?? orden.ingreso_at;
}

/**
 * Estado del SLA para una comanda.
 *
 * Se calcula en el servidor para que el KDS no dependa del reloj del navegador
 * ni de una tarea previa: `alertaSla` es verdadero solo si se superaron los
 * minutos (a los 20 justos todavía no alerta).
 */
export function slaInfo(
  orden: SlaRow,
  now: Date = new Date(),
  slaMinutos: number = SLA_MINUTOS,
): SlaInfo {
  if (!SLA_STATES.includes(orden.estado)) {
    return { minutos: null, alertaSla: false, excedidoPor: null };
  }

  const minutos = Math.max(
    0,
    Math.floor((now.getTime() - slaBase(orden).getTime()) / MINUTO_MS),
  );
  const excedido = minutos - slaMinutos;

  return {
    minutos,
    alertaSla: excedido > 0,
    excedidoPor: excedido > 0 ? excedido : null,
  };
}

/** Corte para saber qué comandas ya pasaron el SLA. */
export function cutoffSla(
  now: Date = new Date(),
  slaMinutos: number = SLA_MINUTOS,
): Date {
  return new Date(now.getTime() - slaMinutos * MINUTO_MS);
}

export function inicioVentana(now: Date, dias: number): Date {
  return new Date(now.getTime() - dias * DIA_MS);
}

/** Minutos entre dos instantes, redondeados a un decimal (o `null`). */
export function minutosEntre(desde: Date | null, hasta: Date | null): number | null {
  if (!desde || !hasta) return null;
  const minutos = (hasta.getTime() - desde.getTime()) / MINUTO_MS;
  if (!Number.isFinite(minutos) || minutos < 0) return null;
  return Math.round(minutos * 10) / 10;
}

export function promedio(valores: (number | null)[]): number | null {
  const reales = valores.filter((valor): valor is number => valor !== null);
  if (!reales.length) return null;
  const suma = reales.reduce((total, valor) => total + valor, 0);
  return Math.round((suma / reales.length) * 10) / 10;
}
