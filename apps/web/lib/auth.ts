/* Identidad y RBAC (fase mocks; la API real llega en fase 3).
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

/** ¿El rol puede operar más de una sucursal (ver switcher)? */
export function canSwitchBranch(role: AppRole): boolean {
  return role === "admin";
}

/** ¿El rol ve una ruta del shell? (el proxy hace cumplir lo mismo en servidor) */
export function canViewPath(pathname: string, role: AppRole): boolean {
  if (role === "superadmin") return pathname.startsWith("/saas");
  if (pathname.startsWith("/saas")) return false;
  if (pathname.startsWith("/app/cocina")) return role === "cocina" || role === "admin" || role === "sucursal";
  if (pathname.startsWith("/app/mozo")) return role === "mesero" || role === "admin" || role === "sucursal";
  if (role === "cocina" || role === "mesero") return false;
  return role === "admin" || role === "sucursal";
}
