/** Redondeo monetario a 2 decimales, sin arrastrar errores de coma flotante. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** `S/ 12.50` con dos decimales (formato del ERP). */
export function fmtMoney(value: number): string {
  return `S/ ${Number(value ?? 0).toFixed(2)}`;
}

/** Redondeo de cantidades de inventario (3 decimales). */
export function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}
