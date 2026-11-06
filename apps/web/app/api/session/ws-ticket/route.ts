/* Ticket efímero para el handshake de Socket.io (AYCDS-14).

   El navegador nunca ve el access token: pide el ticket aquí, el BFF lo
   solicita a la API con el Bearer de la cookie HttpOnly y devuelve solo el
   ticket de 60 s. Sin sesión responde 401 y no toca la API. */

import { NextResponse, type NextRequest } from "next/server";
import { ApiError, API_BASE_URL } from "@/lib/api";
import { TOKEN_COOKIE } from "@/lib/backend";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

function noStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return noStore(
      NextResponse.json(
        { message: "Tu sesión expiró. Vuelve a iniciar sesión." },
        { status: 401 },
      ),
    );
  }

  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) {
    return noStore(
      NextResponse.json(
        { message: "Tu sesión expiró. Vuelve a iniciar sesión." },
        { status: 401 },
      ),
    );
  }

  try {
    const upstream = await fetch(`${API_BASE_URL}/auth/ws-ticket`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return noStore(
        NextResponse.json(
          { message: "No se pudo abrir el canal en vivo." },
          { status: upstream.status === 401 ? 401 : 502 },
        ),
      );
    }

    const data = (await upstream.json()) as { ticket?: unknown; expiresIn?: unknown };
    if (typeof data.ticket !== "string" || !data.ticket) {
      return noStore(
        NextResponse.json(
          { message: "Respuesta inválida del servidor en vivo." },
          { status: 502 },
        ),
      );
    }

    return noStore(
      NextResponse.json({
        ticket: data.ticket,
        expiresIn: typeof data.expiresIn === "number" ? data.expiresIn : 60,
      }),
    );
  } catch (error) {
    const status = error instanceof ApiError && error.status ? error.status : 502;
    return noStore(
      NextResponse.json(
        { message: "No se pudo abrir el canal en vivo." },
        { status: status === 401 ? 401 : 502 },
      ),
    );
  }
}
