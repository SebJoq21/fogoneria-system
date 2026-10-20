/* Logout server-side: borra ambas cookies HttpOnly y redirige al login en la
   misma respuesta. Si la navegación falla, no se simula un logout exitoso. */

import { NextResponse, type NextRequest } from "next/server";
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

export async function GET(request: NextRequest) {
  return clear(NextResponse.redirect(new URL("/", request.url), 303));
}

export async function POST(request: NextRequest) {
  return clear(NextResponse.redirect(new URL("/", request.url), 303));
}
