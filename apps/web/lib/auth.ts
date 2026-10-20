import { NextResponse, type NextRequest } from "next/server";
import { ROLE_HOME, canViewPath } from "./lib/auth";
import { SESSION_COOKIE, verifySession } from "./lib/session";

/**
 * RBAC server-side: verifica la cookie HttpOnly firmada (`fogoneria.session`)
 * y aplica `canViewPath`. La cookie la emite `app/api/session/route.ts`; el
 * cliente no puede leerla ni modificarla desde DevTools.
 */
export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  // `/` es el login: si ya hay sesión, manda al home por rol.
  if (path === "/") {
    if (session) {
      return NextResponse.redirect(new URL(ROLE_HOME[session.role], req.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (!canViewPath(path, session.role)) {
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/app/:path*", "/saas/:path*"],
};

/* Identidad y RBAC. El rol/sucursal vienen del login real (JWT) y se
   guardan en cookies planas para el RBAC optimista del proxy.
   Jerarquía: superadmin (SaaS) > admin (dueño franquicia) >
   sucursal (admin de sucursal) + cocina + mesero (branchId fijo). */

export type AppRole = "superadmin" | "admin" | "sucursal" | "cajero" | "cocina" | "mesero";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  /** null = todas las sucursales (superadmin/admin) */
  branchId: string | null;
  initials: string;
};

export const ROLE_LABEL: Record<AppRole, string> = {
  superadmin: "Superadmin SaaS",
  admin: "Dueño franquicia",
  sucursal: "Admin sucursal",
  cajero: "Cajero",
  cocina: "Cocina",
  mesero: "Mesero",
};

export const ROLE_HOME: Record<AppRole, string> = {
  superadmin: "/saas",
  admin: "/app",
  sucursal: "/app",
  cajero: "/app/caja",
  cocina: "/app/cocina",
  mesero: "/app/mozo",
};

export const demoUsers: AppUser[] = [
  { id: "u-super", name: "Equipo Fogonería", email: "super@fogoneria.com", role: "superadmin", branchId: null, initials: "SA" },
  { id: "u-admin", name: "Martín Quispe", email: "admin@mirestaurante.com", role: "admin", branchId: null, initials: "MQ" },
  { id: "u-suc", name: "Rosa Quispe", email: "sucursal@mirestaurante.com", role: "sucursal", branchId: "miraflores", initials: "RQ" },
  { id: "u-coc", name: "Luis Huamán", email: "cocina@mirestaurante.com", role: "cocina", branchId: "miraflores", initials: "LH" },
  { id: "u-moz", name: "Ana Beltrán", email: "mesero@mirestaurante.com", role: "mesero", branchId: "miraflores", initials: "AB" },
];

export function findDemoUser(email: string): AppUser | null {
  const clean = email.trim().toLowerCase();
  return demoUsers.find((u) => u.email === clean) ?? null;
}

/** Contraseña única de las cuentas demo del seed (ver `apps/api/prisma/seed.ts`). */
export const DEMO_PASSWORD = "Fogoneria123!";

/** Rol de la API (enum `rol_usuario`) → rol del shell web. */
const API_ROLE: Record<string, AppRole> = {
  SUPERADMIN: "superadmin",
  ADMIN_GLOBAL: "admin",
  GERENTE_SUCURSAL: "sucursal",
  CAJERO: "cajero",
  COCINERO: "cocina",
  MESERO: "mesero",
};

export function appRoleFromApi(rol: string): AppRole {
  return API_ROLE[rol] ?? "mesero";
}

export type ApiLoginUser = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  empresaId: string | null;
  sucursalId: string | null;
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase() || "??";
}

/** Usuario de la API → usuario del shell (rol + sucursal real en UUID). */
export function appUserFromApi(user: ApiLoginUser): AppUser {
  const role = appRoleFromApi(user.rol);
  // admin/superadmin operan la empresa completa; el resto queda fijo a su sucursal.
  const branchId =
    role === "admin" || role === "superadmin" ? null : user.sucursalId;
  return {
    id: user.id,
    name: user.nombre,
    email: user.email,
    role,
    branchId,
    initials: initialsOf(user.nombre),
  };
}

/** ¿El rol puede operar más de una sucursal (ver switcher)? */
export function canSwitchBranch(role: AppRole): boolean {
  return role === "admin";
}

/** ¿El rol ve una ruta del shell? (el proxy hace cumplir lo mismo en servidor) */
export function canViewPath(pathname: string, role: AppRole): boolean {
  if (role === "superadmin") return pathname.startsWith("/saas");
  if (pathname.startsWith("/saas")) return false;
  if (pathname.startsWith("/app/mesas/maestro")) return role === "sucursal";
  if (pathname.startsWith("/app/cocina")) return role === "cocina";
  if (pathname.startsWith("/app/mozo")) return role === "mesero";
  if (role === "cajero") {
    // Cobra y opera caja, sin acceso a maestros ni backoffice.
    if (pathname === "/app") return true;
    return ["/app/caja", "/app/comprobantes"].some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );
  }
  if (role === "cocina" || role === "mesero") return false;
  return role === "admin" || role === "sucursal";
}
