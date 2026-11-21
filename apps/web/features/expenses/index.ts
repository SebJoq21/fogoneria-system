/**
 * Feature Gastos.
 *
 * La vista sigue con el estado demo de `ModulesProvider` (AYCDS-27); el cliente
 * `gastosApi` deja listo el contrato de la API sin duplicar el mapeo.
 */

export { GastosPage } from './GastosPage';
export { gastosApi, gastosClient, toGasto } from './api';
export type { ResumenGastos } from './api';
export type {
  CategoriaGasto,
  EstadoPago,
  Gasto,
  GastoInput,
  PagoGastoInput,
} from '@fogoneria/contracts/expenses';
