import { round2 } from "./money";

/** Número decimal inmediatamente antes de un símbolo (p. ej. `10%`), sin regex. */
export function numberBefore(value: string, symbol: string): number | null {
  const index = value.indexOf(symbol);
  if (index <= 0) return null;
  const prefix = value.slice(0, index).trimEnd();
  let start = prefix.length;
  while (start > 0) {
    const code = prefix.charCodeAt(start - 1);
    if ((code < 48 || code > 57) && code !== 46) break;
    start -= 1;
  }
  const parsed = Number.parseFloat(prefix.slice(start));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Número decimal inmediatamente después de un símbolo (p. ej. `$5.00`), sin regex. */
export function numberAfter(value: string, symbol: string): number | null {
  const index = value.indexOf(symbol);
  if (index < 0) return null;
  const tail = value.slice(index + 1).trimStart();
  let end = 0;
  while (end < tail.length) {
    const code = tail.charCodeAt(end);
    if ((code < 48 || code > 57) && code !== 46) break;
    end += 1;
  }
  const parsed = Number.parseFloat(tail.slice(0, end));
  return Number.isFinite(parsed) ? parsed : null;
}

/** "10% OFF" → porcentaje; "$5.00 Descuento" → monto fijo. */
export function parseCouponDiscount(
  coupon: { discount: string },
  base: number,
): number {
  const pct = numberBefore(coupon.discount, "%");
  if (pct !== null) return round2((base * pct) / 100);
  const fixed = numberAfter(coupon.discount, "$");
  if (fixed !== null) return round2(Math.min(fixed, base));
  return 0;
}
