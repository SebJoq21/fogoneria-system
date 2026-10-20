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
