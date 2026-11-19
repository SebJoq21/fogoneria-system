/**
 * API pública del módulo Catálogo.
 *
 * Otros módulos no deben importar `catalog.service`, los DTOs ni el repositorio:
 * solo este punto de entrada. Si un módulo necesita el catálogo (p. ej. órdenes
 * resolviendo precios o combos), se le expone un puerto aquí.
 */
export { CatalogModule } from './catalog.module.js';
export { CatalogService } from './catalog.service.js';
