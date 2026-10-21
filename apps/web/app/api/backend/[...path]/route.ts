/* BFF de la API: reenvía las llamadas del navegador a NestJS adjuntando el
   access token desde la cookie HttpOnly. Así el JWT no queda en localStorage
   ni es accesible para un XSS. */

import { NextResponse, type NextRequest } from "next/server";
import { API_BASE_URL } from "@/lib/api";
import { TOKEN_COOKIE } from "@/lib/backend";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

type RouteContext = { params: Promise<{ path: string[] }> };

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function unauthorized(): NextResponse {
  return NextResponse.json(
    { message: "Tu sesión expiró. Vuelve a iniciar sesión." },
    { status: 401, headers: { "cache-control": "no-store" } },
  );
}

async function forward(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  // El RBAC vive en la cookie firmada; sin sesión válida no se reenvía nada,
  // aunque el access token siguiera presente.
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return unauthorized();

  if (MUTATING.has(request.method)) {
    const origin = request.headers.get("origin");
    if (origin) {
      // No comparar contra `request.nextUrl.origin`: en Next standalone se arma
      // con HOSTNAME (0.0.0.0 en Docker) y rechazaría el mismo origen real.
      const forwarded = request.headers.get("x-forwarded-host");
      const host = (forwarded ?? request.headers.get("host") ?? "").split(",")[0]?.trim();
      let originHost = "";
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = "";
      }
      if (!originHost || !host || originHost !== host) {
        return NextResponse.json({ message: "Origen no permitido." }, { status: 403 });
      }
    }
  }

  const { path } = await context.params;
  const target = new URL(`${API_BASE_URL}/${path.map(encodeURIComponent).join("/")}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const accept = request.headers.get("accept");
  if (accept) headers.set("accept", accept);
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  if (token) headers.set("authorization", `Bearer ${token}`);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return NextResponse.json(
      { message: "No se pudo conectar con la API." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }

  const outHeaders = new Headers();
  const upstreamType = upstream.headers.get("content-type");
  if (upstreamType) outHeaders.set("content-type", upstreamType);
  outHeaders.set("cache-control", "no-store");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: outHeaders,
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const HEAD = forward;
