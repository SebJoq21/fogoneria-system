/**
 * Metadata del módulo Caja para el registry/nav generado.
 * La entrada del sidebar (`Caja`) vive en `modules/catalog.json`.
 */
export const cashModule = {
  id: 'cash',
  label: 'Caja',
  icon: 'Banknote',
  path: '/app/caja',
  roles: ['admin', 'sucursal', 'cajero'],
  group: 'Principal',
  provider: 'CashProvider',
};
