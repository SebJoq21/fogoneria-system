/**
 * Puerto de caja del módulo Caja.
 *
 * Gastos necesita dejar el egreso en el turno abierto cuando se paga en
 * efectivo, pero las reglas de `movimientos_caja` viven en un solo sitio. Este
 * contrato evita que gastos importe `CashService` o la tabla.
 */
export const CASH_PORT = Symbol('CASH_PORT');

export type EgresoDeGastoInput = {
  concepto: string;
  monto: number;
  gastoId: string;
  actorId?: string | null;
};

export type EgresoDeGastoResultado = {
  movimiento: { id: string };
  turno: { id: string; sucursal_id: string };
};

export interface CashPort {
  /**
   * Registra el `EGRESO` de un gasto en el turno `ABIERTO` de la sucursal.
   * Sin turno abierto lanza 409: primero se abre caja.
   */
  egresoDeGasto(
    sucursalId: string,
    input: EgresoDeGastoInput,
  ): Promise<EgresoDeGastoResultado>;
}
