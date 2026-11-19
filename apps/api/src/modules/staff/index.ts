/**
 * API pública del módulo RRHH.
 *
 * Otros módulos no deben importar `staff.service`, los DTOs ni el repositorio:
 * solo este punto de entrada. Si un módulo necesita datos de RRHH (p. ej. el
 * pozo de propinas), se le expone un puerto aquí.
 */
export { StaffModule } from './staff.module.js';
export { StaffService } from './staff.service.js';
