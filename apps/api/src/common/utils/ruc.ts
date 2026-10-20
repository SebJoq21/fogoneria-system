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
  const remainder = sum % 11;
  const checkDigit = remainder < 2 ? remainder : 11 - remainder;
  return checkDigit === Number(ruc[10]);
}
