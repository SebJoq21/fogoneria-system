/**
 * Contrato de autenticación de la web: roles del shell, usuario de sesión y
 * respuesta del login. La sesión real (cookie HttpOnly, BFF y `proxy.ts`) no
 * vive aquí: este contrato solo describe las formas de presentación.
 */

import type { PlanEmpresa } from './billing';
import type { EstadoEmpresa } from './tenant';

export type RolWeb = 'superadmin' | 'admin' | 'sucursal' | 'cajero' | 'cocina' | 'mesero';

export const ROLES_WEB: readonly RolWeb[] = [
  'superadmin',
  'admin',
  'sucursal',
  'cajero',
  'cocina',
  'mesero',
];

/** Rol de la API (`rol_usuario`) → rol del shell web. `null` = rechazar. */
const ROL_API: Record<string, RolWeb> = {
  SUPERADMIN: 'superadmin',
  ADMIN_GLOBAL: 'admin',
  GERENTE_SUCURSAL: 'sucursal',
  CAJERO: 'cajero',
  COCINERO: 'cocina',
  MESERO: 'mesero',
};

export function esRolWeb(value: string): value is RolWeb {
  return (ROLES_WEB as readonly string[]).includes(value);
}

export function rolDesdeApi(rol: string): RolWeb | null {
  return ROL_API[rol] ?? null;
}

export function etiquetaRol(rol: RolWeb): string {
  switch (rol) {
    case 'superadmin':
      return 'Superadmin SaaS';
    case 'admin':
      return 'Dueño franquicia';
    case 'sucursal':
      return 'Admin sucursal';
    case 'cajero':
      return 'Cajero';
    case 'cocina':
      return 'Cocina';
    default:
      return 'Mesero';
  }
}

export type UsuarioSesion = {
  id: string;
  nombre: string;
  email: string;
  rol: RolWeb;
  /** Empresa del token; `null` en superadmin sin tenant. */
  empresaId: string | null;
  /** `null` = todas las sucursales (admin/superadmin). */
  sucursalId: string | null;
};

export type EmpresaSesion = {
  id: string;
  nombre: string;
  estado: EstadoEmpresa;
  plan: PlanEmpresa;
  trialFin: string | null;
};

export type RespuestaLogin = {
  accessToken: string;
  tokenType: string;
  expiresIn: string;
  user: UsuarioSesion;
  tenant: EmpresaSesion | null;
};
