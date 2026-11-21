/**
 * Metadata del módulo Auth para el registry generado.
 * `/` y `/recuperar` son rutas públicas; no tienen entrada de sidebar.
 */
export const authModule = {
  id: 'auth',
  label: 'Acceso',
  icon: 'LogIn',
  path: '/',
  roles: ['superadmin', 'admin', 'sucursal', 'cajero', 'cocina', 'mesero'],
  group: 'Plataforma',
};
