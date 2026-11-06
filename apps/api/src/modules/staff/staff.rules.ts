/**
 * Reparto exacto del pozo de propinas (AYCDS-33).
 *
 * Divide el total entre los beneficiarios **sin perder ni un céntimo**: la
 * parte base se trunca a céntimos y el residuo (0 a n-1 céntimos) se reparte
 * de a un céntimo entre los primeros. Así la suma de los repartos es siempre
 * igual al total, que es lo que exige el arqueo del pozo.
 *
 * @example repartirPropinas(100, 3) -> [33.34, 33.33, 33.33]
 */
export function repartirPropinas(total: number, beneficiarios: number): number[] {
  if (beneficiarios <= 0) return [];
  const centimos = Math.round(Math.max(0, total) * 100);
  const base = Math.floor(centimos / beneficiarios);
  let residuo = centimos - base * beneficiarios;

  return Array.from({ length: beneficiarios }, () => {
    const extra = residuo > 0 ? 1 : 0;
    residuo -= extra;
    return (base + extra) / 100;
  });
}

/** ¿La asistencia cuenta para el reparto? Presente o tarde, sí; falta no. */
export function cuentaParaPropinas(estado: string): boolean {
  return estado === 'PRESENTE' || estado === 'TARDANZA';
}

/** Fecha (día) de Lima en formato `YYYY-MM-DD`, la que usa el plan y el pozo. */
export function diaLima(now: Date = new Date()): string {
  const lima = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  return lima.toISOString().slice(0, 10);
}
