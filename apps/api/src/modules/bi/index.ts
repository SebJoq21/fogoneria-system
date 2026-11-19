/**
 * API pública del módulo BI (AYCDS-35).
 *
 * Los reportes se leen siempre dentro de la transacción del request con el
 * contexto RLS; los demás módulos importan este `index`, nunca los internals.
 */
export { BiModule } from './bi.module.js';
export { BiService } from './bi.service.js';
