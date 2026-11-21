/**
 * API pública del módulo de autenticación web.
 *
 * La sesión real la emite el BFF (`/api/session`) y la firma `lib/session.ts`;
 * esta feature solo expone las rutas y tipos que consumen las páginas.
 */
export const AUTH_SESSION_PATH = '/api/session';
export const AUTH_LOGOUT_PATH = '/api/session/logout';

export type { RespuestaLogin, RolWeb, UsuarioSesion } from '@fogoneria/contracts/auth';
