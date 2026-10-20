import { SetMetadata } from '@nestjs/common';
import type { RolUsuario } from '../types/authenticated-user.js';

export const ROLES_KEY = 'roles';

/** Restringe la ruta a los roles indicados. */
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_KEY, roles);
