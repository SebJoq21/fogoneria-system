import type { rol_usuario } from '../../generated/prisma/enums.js';

export type RolUsuario = rol_usuario;

export interface JwtPayload {
  sub: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  empresaId: string | null;
  sucursalId: string | null;
}

export type AuthenticatedUser = JwtPayload;

/** Marca de un ticket de WebSocket: no sirve como access token HTTP. */
export const WS_TICKET_SCOPE = 'ws';

/**
 * Ticket efímero para el handshake de Socket.io (AYCDS-14).
 *
 * Vive 60 segundos y solo lleva lo necesario para ubicar el tenant y la
 * sucursal en los rooms. Lleva `scope: 'ws'` y `JwtStrategy` rechaza cualquier
 * token con `scope`: un ticket no abre la API HTTP, y el gateway rechaza
 * cualquier token sin `scope === 'ws'`.
 */
export interface WsTicketPayload {
  sub: string;
  empresaId: string | null;
  sucursalId: string | null;
  rol: RolUsuario;
  scope: typeof WS_TICKET_SCOPE;
}
