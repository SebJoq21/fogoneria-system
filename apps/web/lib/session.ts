/* Sesión de navegación (servidor): JWT firmado con `SESSION_SECRET` que vive
   en una cookie HttpOnly. `proxy.ts` lo verifica para aplicar el RBAC; el
   cliente nunca puede leerlo ni alterarlo. El access token de la API vive en
   otra cookie HttpOnly y solo lo usa el BFF (`app/api/backend`). */

import { SignJWT, jwtVerify } from "jose";
import type { AppRole } from "./auth";

export const SESSION_COOKIE = "fogoneria.session";
/** Ventana deslizante: el proxy renueva la cookie en cada navegación. */
export const SESSION_MAX_AGE_SECONDS = 15 * 60;
/** Tope absoluto aunque la sesión se refresque. */
export const SESSION_ABSOLUTE_MAX_SECONDS = 8 * 60 * 60;

const ROLES: readonly AppRole[] = [
  "superadmin",
  "admin",
  "sucursal",
  "cajero",
  "cocina",
  "mesero",
];
const DEV_SECRET = "dev-only-session-secret-change-me-32chars";

export type SessionPayload = {
  sub: string;
  role: AppRole;
  branchId: string | null;
  /** epoch en segundos; no se renueva al refrescar (tope absoluto). */
  startedAt: number;
};

function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

function secretKey(): Uint8Array {
  const configured = process.env.SESSION_SECRET?.trim();
  const isExplicitDev = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
  const secret = configured || (isExplicitDev ? DEV_SECRET : "");
  if (secret.length < 32) {
    throw new Error(
      "SESSION_SECRET debe tener al menos 32 caracteres (obligatorio fuera de development/test)",
    );
  }
  return new TextEncoder().encode(secret);
}

/** Firma una sesión; `ttlSeconds` solo se usa en pruebas. */
export async function signSession(
  payload: SessionPayload,
  ttlSeconds: number = SESSION_MAX_AGE_SECONDS,
): Promise<string> {
  return new SignJWT({
    role: payload.role,
    branchId: payload.branchId,
    startedAt: payload.startedAt,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secretKey());
}

/** Opciones de la cookie de sesión (compartidas por el BFF y el proxy). */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/** Devuelve la sesión solo si la firma, el rol, la expiración y el tope absoluto son válidos. */
export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || !payload.sub || !isAppRole(payload.role)) {
      return null;
    }
    if (typeof payload.startedAt !== "number" || !Number.isFinite(payload.startedAt)) {
      return null;
    }
    const ageSeconds = Math.floor(Date.now() / 1000) - payload.startedAt;
    if (ageSeconds < 0 || ageSeconds > SESSION_ABSOLUTE_MAX_SECONDS) {
      return null;
    }
    return {
      sub: payload.sub,
      role: payload.role,
      branchId: typeof payload.branchId === "string" ? payload.branchId : null,
      startedAt: payload.startedAt,
    };
  } catch {
    return null;
  }
}
