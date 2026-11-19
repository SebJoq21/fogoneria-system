/**
 * API pública del tenant: contexto de la empresa y sus sucursales.
 *
 * El contexto RLS lo sigue fijando `TenantContextService` desde el JWT; este
 * módulo solo expone la lectura de `/tenant` y `/tenant/branches`.
 */
export { TenantModule } from './tenant.module.js';
export { TenantService } from './tenant.service.js';
