/** Lima no tiene horario de verano: el offset es fijo (UTC-05:00). */
const LIMA_OFFSET = '-05:00';
const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Rango [inicio, fin) del día indicado en hora de Lima. Sin esto, una reserva
 * de las 20:00 de Lima cae en el día siguiente en UTC y desaparece del filtro.
 */
export function limaDayRange(fecha: string): { start: Date; end: Date } | null {
  const start = new Date(`${fecha}T00:00:00${LIMA_OFFSET}`);
  if (Number.isNaN(start.getTime())) return null;
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** Día calendario en Lima (`YYYYMMDD`) de un instante cualquiera. */
export function limaDayKey(fecha: Date): string {
  const lima = new Date(fecha.getTime() - LIMA_OFFSET_MS);
  return lima.toISOString().slice(0, 10).replaceAll('-', '');
}
