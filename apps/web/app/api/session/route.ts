/* BFF de sesión: valida credenciales contra la API y emite dos cookies
   HttpOnly (`fogoneria.session` para el RBAC y `fogoneria.token` para llamar
   a la API). El navegador nunca recibe el access token. */

import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api";
import { loginRequest } from "@/lib/auth-api";
import { TOKEN_COOKIE, tokenCookieOptions } from "@/lib/backend";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
} from "@/lib/session";
import { clearSessionRateLimit, hitSessionRateLimit } from "@/lib/session-rate-limit";

type SessionBody = { email?: unknown; password?: unknown };

function noStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  return response;
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

export async function POST(request: Request) {
  const key = clientKey(request);
  const limit = hitSessionRateLimit(key);
  if (!limit.allowed) {
    return noStore(
      NextResponse.json(
        { message: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." },
        { status: 429, headers: { "retry-after": String(limit.retryAfter) } },
      ),
    );
  }

  let body: SessionBody;
  try {
    body = (await request.json()) as SessionBody;
  } catch {
    return noStore(NextResponse.json({ message: "Cuerpo inválido" }, { status: 400 }));
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return noStore(
      NextResponse.json({ message: "Ingresa tu correo y contraseña." }, { status: 400 }),
    );
  }

  try {
    const { user, accessToken } = await loginRequest(email, password);
    const session = await signSession({
      sub: user.id,
      role: user.role,
      branchId: user.branchId,
      startedAt: Math.floor(Date.now() / 1000),
    });

    clearSessionRateLimit(key);

    const response = NextResponse.json({ user });
    response.cookies.set(SESSION_COOKIE, session, sessionCookieOptions());
    response.cookies.set(TOKEN_COOKIE, accessToken, tokenCookieOptions());
    // Limpia las cookies planas de la fase anterior (fogoneria.role|branch).
    response.cookies.delete("fogoneria.role");
    response.cookies.delete("fogoneria.branch");
    return noStore(response);
  } catch (error) {
    if (error instanceof ApiError) {
      return noStore(
        NextResponse.json(
          { message: error.message },
          { status: error.status >= 400 ? error.status : 502 },
        ),
      );
    }
    return noStore(
      NextResponse.json(
        { message: "No se pudo iniciar sesión. Inténtalo de nuevo." },
        { status: 502 },
      ),
    );
  }
}

/** Logout por API (el navegador usa `GET /api/session/logout`). */
export async function DELETE() {
  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(TOKEN_COOKIE);
  response.cookies.delete("fogoneria.role");
  response.cookies.delete("fogoneria.branch");
  return noStore(response);
}
