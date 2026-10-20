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
