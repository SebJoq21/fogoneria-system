/**
 * API pública del módulo CRM (comensales, puntos y lealtad).
 *
 * El CRM no depende de otros módulos de negocio: lee las comandas `PAGADA` y
 * `movimientos_puntos` con Prisma scoped. Los demás módulos importan este
 * `index` (módulo y servicio), nunca sus internals.
 */
export { CrmModule } from './crm.module.js';
export { CrmService } from './crm.service.js';
export type { ConfigLealtad } from './crm.rules.js';
