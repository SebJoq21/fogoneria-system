/**
 * Puerto de precios del módulo Precios.
 *
 * Órdenes (y cualquier otro módulo) consume este contrato, no la tabla
 * `precios_platos` ni `PricingService`. Así un cambio en cómo se resuelve un
 * precio (lista activa, vigencias, promociones) no obliga a tocar órdenes.
 */
export const PRICING_PORT = Symbol('PRICING_PORT');

export type PreciosResueltos = {
  /** Lista usada para cotizar; `null` si no hay ninguna activa. */
  listaId: string | null;
  /** Precio por plato. Un plato ausente no cotiza en esa lista. */
  precios: ReadonlyMap<string, number>;
};

export interface PricingPort {
  /**
   * Resuelve en lote el precio de varios platos para una comanda (AYCDS-22).
   *
   * - Sin `listaId`, usa la lista activa.
   * - Con `listaId`, valida que exista (404 si no).
   * - No devuelve error por platos sin precio: el llamador decide el mensaje.
   */
  resolvePrices(platoIds: string[], listaId?: string | null): Promise<PreciosResueltos>;
}
