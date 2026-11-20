import type { Product } from "./erp-catalog";

/** Último número de un texto (p. ej. el sufijo de `PLA-012`), sin regex. */
export function trailingNumber(value: string): number {
  const text = value.trimEnd();
  let start = text.length;
  while (start > 0) {
    const code = text.charCodeAt(start - 1);
    if (code < 48 || code > 57) break;
    start -= 1;
  }
  return start === text.length ? 0 : Number(text.slice(start));
}

/** Siguiente SKU secuencial (PLA-00N) a partir del maestro actual. */
export function nextSku(products: Pick<Product, "sku">[]): string {
  const max = products.reduce((acc, p) => {
    const suffix = trailingNumber(p.sku);
    return Number.isFinite(suffix) ? Math.max(acc, suffix) : acc;
  }, 0);
  return `PLA-${String(max + 1).padStart(3, "0")}`;
}
