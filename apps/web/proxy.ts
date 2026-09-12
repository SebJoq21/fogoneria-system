import { NextResponse, type NextRequest } from "next/server";
import { ROLE_HOME, canViewPath, type AppRole } from "./lib/auth";

const VALID_ROLES: AppRole[] = ["superadmin", "admin", "sucursal", "cocina", "mesero"];

/**
 * RBAC optimista (fase mocks): lee rol/branch de cookies planas que fija el
 * login. Sin DB aquí por rendimiento (patrón doc oficial Next.js Proxy).
 * La API real (fase 3) revalida JWT + tenant en cada request.
 */
export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const role = req.cookies.get("fogoneria.role")?.value as AppRole | undefined;
  const authed = !!role && VALID_ROLES.includes(role);

  // `/` es el login: si ya hay sesión, manda al home por rol.
  if (path === "/") {
    if (authed) {
      return NextResponse.redirect(new URL(ROLE_HOME[role], req.url));
    }
    return NextResponse.next();
  }

  if (!authed) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (!canViewPath(path, role)) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/app/:path*", "/saas/:path*"],
};
