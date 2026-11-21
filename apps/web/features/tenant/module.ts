/**
 * Metadata del módulo Tenant para el registry generado.
 * No tiene ruta propia: el `BranchSwitcher` vive en el shell y `TenantProvider`
 * hidrata empresa/sucursales.
 */
export const tenantModule = {
  id: 'tenant',
  label: 'Sucursal',
  icon: 'Building2',
  path: '/app',
  roles: ['admin', 'sucursal'],
  group: 'Plataforma',
  provider: 'TenantProvider',
};
