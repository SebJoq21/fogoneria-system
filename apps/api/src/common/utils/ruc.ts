/**
 * Valida un RUC peruano de 11 dígitos con su dígito verificador (módulo 11).
 * Misma regla que usa el frontend para el alta de empresas.
 */
export function isValidRuc(value: string): boolean {
  const ruc = value.trim();
  if (!/^\d{11}$/.test(ruc)) return false;

  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += Number(ruc[i]) * weights[i];
  }
  // Algoritmo SUNAT: (11 - resto) % 10 (resto 0 → 1, resto 1 → 0).
  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === Number(ruc[10]);
}
