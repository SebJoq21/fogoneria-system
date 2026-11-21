/**
 * Metadata del módulo CRM para el registry/nav generado.
 *
 * `CrmProvider` es el dueño del estado demo de clientes desde F6; la API manda
 * cuando hay sesión.
 */
export const crmModule = {
  id: 'crm',
  label: 'Comensales',
  icon: 'Users',
  path: '/app/clientes',
  roles: ['admin', 'sucursal'],
  group: 'Clientes',
  provider: 'CrmProvider',
};
