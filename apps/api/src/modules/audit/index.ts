/**
 * API pública de auditoría.
 *
 * Es un módulo `@Global` que usan casi todos los servicios; exponerlo por su
 * `index` permite que los demás módulos lo importen sin violar la frontera
 * (solo se permite el punto de entrada público).
 */
export { AuditModule } from './audit.module.js';
export { AuditService } from './audit.service.js';
