/** Redondeo monetario a 2 decimales. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
