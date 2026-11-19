/**
 * Fechas del negocio en hora de Lima (UTC-05:00 fijo, sin DST).
 *
 * Todo el sistema mide los días así: una venta de las 21:00 en Lima no puede
 * caer en el día siguiente (UTC).
 */

const OFFSET_LIMA_MS = 5 * 60 * 60 * 1000;

/** Día de Lima en `YYYY-MM-DD`. */
export function diaLima(now: Date = new Date()): string {
  return new Date(now.getTime() - OFFSET_LIMA_MS).toISOString().slice(0, 10);
}

/** Rango de los últimos `dias` días (incluye hoy) en día de Lima. */
export function ultimosDias(
  dias: number,
  now: Date = new Date(),
): { desde: string; hasta: string } {
  const hasta = diaLima(now);
  const fin = new Date(`${hasta}T00:00:00.000Z`);
  const inicio = new Date(fin.getTime() - (dias - 1) * 86_400_000);
  return { desde: inicio.toISOString().slice(0, 10), hasta };
}

/** Etiqueta corta del día (`Lun`, `Mar`, …) para gráficos. */
export function diaCorto(fecha: string): string {
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const date = new Date(`${fecha}T00:00:00.000Z`);
  return dias[date.getUTCDay()] ?? fecha;
}

/** Inicio y fin (exclusivo) de un día de Lima, para filtrar timestamps. */
export function rangoDiaLima(fecha: string): { start: Date; end: Date } {
  const start = new Date(`${fecha}T00:00:00-05:00`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}
