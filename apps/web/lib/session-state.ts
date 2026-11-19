/* Persistencia de presentación de la sesión. La autoridad sigue siendo la
   cookie HttpOnly `fogoneria.session` verificada en `proxy.ts`; aquí solo se
   guarda el usuario para pintar el shell sin un viaje extra al servidor. */

import type { AppUser } from "./auth";
import { ANON_TENANT_KEY } from "./persistence";

/** Clave del usuario del shell (misma clave histórica; no cambia el formato). */
export const SESSION_USER_KEY = "fogoneria:user";

/** Clave de la sucursal activa por empresa (vista `todas` si no hay). */
export function branchStorageKey(tenantKey: string): string {
  return `fogoneria:branch:${tenantKey}`;
}

/** Namespace de persistencia del tenant: la empresa del usuario o `anon`. */
export function tenantKeyOf(user: AppUser | null): string {
  return user?.empresaId ?? ANON_TENANT_KEY;
}

/**
 * Usuario guardado en el navegador. Tolera JSON inválido y payloads sin
 * `id`/`role` (una versión vieja del formato no debe romper el arranque).
 */
export function parseSessionUser(raw: string | null): AppUser | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AppUser> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.id || !parsed.role) return null;
    return parsed as AppUser;
  } catch {
    return null;
  }
}

/** Persiste el usuario del shell (best-effort: el almacenamiento puede fallar). */
export function storeSessionUser(user: AppUser): void {
  try {
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Borra el usuario del shell y la sucursal recordada de su empresa. */
export function clearSessionUser(user: AppUser | null): void {
  try {
    localStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem(branchStorageKey(tenantKeyOf(user)));
    // Cookies planas heredadas: el RBAC real usa la cookie firmada del proxy.
    document.cookie = "fogoneria.role=; path=/; max-age=0";
    document.cookie = "fogoneria.branch=; path=/; max-age=0";
  } catch {
    /* almacenamiento no disponible */
  }
}
