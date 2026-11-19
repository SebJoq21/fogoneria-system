/**
 * API pública del módulo Mesas.
 *
 * Otros módulos no deben importar `tables.service`, los DTOs ni el repositorio:
 * solo este punto de entrada. Si un módulo necesita las mesas (p. ej. órdenes o
 * reservas validando la mesa), se le expone un puerto aquí.
 */
export { TablesModule } from './tables.module.js';
export { TablesService } from './tables.service.js';
