/**
 * Feature Inventario (stock, escandallos y kardex).
 *
 * El maestro de insumos, los ajustes y las recetas siguen en el estado demo de
 * `ModulesProvider` (AYCDS-24); el semáforo y el kardex ya salen de la API.
 * Las rutas y `ModuleGate` solo importan este índice.
 */

export { InventoryPage } from './InventoryPage';
export { MovementsPage } from './MovementsPage';
export { InventoryHubPage } from './InventoryHubPage';
export {
  inventarioApi,
  inventarioClient,
  kardexRowFromApi,
  semaforoDeStock,
} from './api';
export type { KardexApi, ListarMovimientosParams } from './api';
export type {
  ConsumoResultado,
  EstadoStock,
  EstadoStockSucursal,
  FiltroMovimientos,
  InsumoStock,
  MovimientoInventario,
  ResumenStock,
  TipoMovimientoInventario,
} from '@fogoneria/contracts/inventario';
