/* Identidad y RBAC. El rol/sucursal vienen del login real y viajan al
   servidor en la cookie HttpOnly `fogoneria.session` (ver `lib/session.ts`).
   Jerarquía: superadmin (SaaS) > admin (dueño franquicia) >
   sucursal (admin de sucursal) + cocina + mesero (branchId fijo). */

export type AppRole = "superadmin" | "admin" | "sucursal" | "cocina" | "mesero";

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
  cocina: "Cocina",
  mesero: "Mesero",
};

export const ROLE_HOME: Record<AppRole, string> = {
  superadmin: "/saas",
  admin: "/app",
  sucursal: "/app",
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
  CAJERO: "sucursal",
  COCINERO: "cocina",
  MESERO: "mesero",
};

export function appRoleFromApi(rol: string): AppRole {
  return API_ROLE[rol] ?? "mesero";
}

/** Sucursales del seed: la API usa UUID, el shell web usa slug. */
const SEED_BRANCH_SLUGS: Record<string, string> = {
  "22222222-2222-2222-2222-222222222222": "miraflores",
  "33333333-3333-3333-3333-333333333333": "surco",
  "44444444-4444-4444-4444-444444444444": "san-isidro",
};

/** uuid de sucursal → slug del shell; `null` cuando es desconocida (= todas). */
export function branchSlugFromApi(sucursalId: string | null): string | null {
  if (!sucursalId) return null;
  return SEED_BRANCH_SLUGS[sucursalId] ?? null;
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

/** Usuario de la API → usuario del shell (rol + sucursal en slug). */
export function appUserFromApi(user: ApiLoginUser): AppUser {
  const role = appRoleFromApi(user.rol);
  const branchId = role === "admin" || role === "superadmin" ? null : branchSlugFromApi(user.sucursalId);
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
  if (role === "cocina" || role === "mesero") return false;
  return role === "admin" || role === "sucursal";
}
