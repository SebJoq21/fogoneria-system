/* Sesión de navegación (servidor): JWT firmado con `SESSION_SECRET` que vive
   en una cookie HttpOnly. `proxy.ts` lo verifica para aplicar el RBAC; el
   cliente nunca puede leerlo ni alterarlo. El JWT de la API sigue viajando
   aparte en `lib/api.ts` para las llamadas al backend. */

import { SignJWT, jwtVerify } from "jose";
import type { AppRole } from "./auth";

export const SESSION_COOKIE = "fogoneria.session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const ROLES: readonly AppRole[] = ["superadmin", "admin", "sucursal", "cajero", "cocina", "mesero"];
const DEV_SECRET = "dev-only-session-secret-change-me-32chars";

export type SessionPayload = {
  sub: string;
  role: AppRole;
  branchId: string | null;
};

function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

function secretKey(): Uint8Array {
  const configured = process.env.SESSION_SECRET?.trim();
  const secret = configured || (process.env.NODE_ENV === "production" ? "" : DEV_SECRET);
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET debe tener al menos 32 caracteres");
  }
  return new TextEncoder().encode(secret);
}

/** Firma una sesión; `ttlSeconds` solo se usa en pruebas. */
export async function signSession(
  payload: SessionPayload,
  ttlSeconds: number = SESSION_MAX_AGE_SECONDS,
): Promise<string> {
  return new SignJWT({ role: payload.role, branchId: payload.branchId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secretKey());
}

/** Devuelve la sesión solo si la firma, el rol y la expiración son válidos. */
export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || !payload.sub || !isAppRole(payload.role)) {
      return null;
    }
    return {
      sub: payload.sub,
      role: payload.role,
      branchId: typeof payload.branchId === "string" ? payload.branchId : null,
    };
  } catch {
    return null;
  }
}

