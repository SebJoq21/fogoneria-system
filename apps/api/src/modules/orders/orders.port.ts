/**
 * Puerto de órdenes del módulo Órdenes.
 *
 * Caja es el único camino para dejar una comanda `PAGADA` (AYCDS-34), pero no
 * necesita conocer `OrdersService`, su modelo ni sus DTOs: solo este contrato.
 * La implementación corre en la misma transacción del request.
 */
export const ORDERS_PORT = Symbol('ORDERS_PORT');

export interface OrdersPort {
  /**
   * Marca la comanda como `PAGADA` (transición + liberación de mesa + evento
   * en vivo). Solo lo llama caja después de registrar el cobro.
   */
  markPaid(id: string): Promise<unknown>;
}
