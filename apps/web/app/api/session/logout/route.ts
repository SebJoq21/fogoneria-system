/* Logout server-side: borra ambas cookies HttpOnly y redirige al login en la
   misma respuesta. Si la navegación falla, no se simula un logout exitoso. */

import { NextResponse } from "next/server";
import { TOKEN_COOKIE } from "@/lib/backend";
import { SESSION_COOKIE } from "@/lib/session";

function clear(response: NextResponse): NextResponse {
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(TOKEN_COOKIE);
  response.cookies.delete("fogoneria.role");
  response.cookies.delete("fogoneria.branch");
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function GET(): Promise<NextResponse> {
  // `Location` relativo: en Next standalone `request.url` usa HOSTNAME (0.0.0.0
  // dentro de Docker) y el navegador no puede navegar a esa dirección.
  return clear(new NextResponse(null, { status: 303, headers: { location: "/" } }));
}

export async function POST(): Promise<NextResponse> {
  return clear(new NextResponse(null, { status: 303, headers: { location: "/" } }));
}
