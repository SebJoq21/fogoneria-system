import { NextResponse, type NextRequest } from "next/server";
import { ROLE_HOME, canViewPath } from "./lib/auth";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
  verifySession,
  type SessionPayload,
} from "./lib/session";

/**
 * RBAC server-side: verifica la cookie HttpOnly firmada (`fogoneria.session`)
 * y aplica `canViewPath`. La cookie la emite `app/api/session/route.ts`; el
 * cliente no puede leerla ni modificarla desde DevTools.
 *
 * La sesión se refresca en cada navegación (ventana deslizante de 15 min) para
 * que un cambio de rol/debaja no quede congelado 8 h; el tope absoluto de la
 * sesión es de 8 h (`SESSION_ABSOLUTE_MAX_SECONDS`).
 */
async function withSession(response: NextResponse, session: SessionPayload): Promise<NextResponse> {
  const token = await signSession(session);
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  // `/` es el login: si ya hay sesión, manda al home por rol.
  if (path === "/") {
    if (session) {
      return withSession(
        NextResponse.redirect(new URL(ROLE_HOME[session.role], req.url)),
        session,
      );
    }
    return NextResponse.next();
  }

  if (!session) {
    const response = NextResponse.redirect(new URL("/", req.url));
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  if (!canViewPath(path, session.role)) {
    return withSession(
      NextResponse.redirect(new URL(ROLE_HOME[session.role], req.url)),
      session,
    );
  }

  return withSession(NextResponse.next(), session);
}

export const config = {
  matcher: ["/", "/app/:path*", "/saas/:path*"],
};
