/**
 * API pública de la consola SaaS (superadmin): tenants, planes y métricas.
 *
 * Usa `prisma.raw` con bypass de tenant por diseño; el aislamiento lo garantiza
 * el rol `SUPERADMIN` de `RolesGuard`.
 */
export { SaasModule } from './saas.module.js';
export { SaasService } from './saas.service.js';
