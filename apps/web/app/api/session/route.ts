/* BFF de sesión: valida credenciales contra la API y emite la cookie
   HttpOnly que usa `proxy.ts` para el RBAC. El JWT de la API se devuelve
   al cliente para las llamadas a `/api/v1` (no se guarda en la cookie). */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api";
import { loginRequest } from "@/lib/auth-api";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession } from "@/lib/session";

type SessionBody = { email?: unknown; password?: unknown };

export async function POST(request: Request) {
  let body: SessionBody;
  try {
    body = (await request.json()) as SessionBody;
  } catch {
    return NextResponse.json({ message: "Cuerpo inválido" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ message: "Ingresa tu correo y contraseña." }, { status: 400 });
  }

  try {
    const { user, accessToken } = await loginRequest(email, password);
    const token = await signSession({
      sub: user.id,
      role: user.role,
      branchId: user.branchId,
    });

    const store = await cookies();
    store.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    // Limpia las cookies planas de la fase anterior (fogoneria.role|branch).
    store.delete("fogoneria.role");
    store.delete("fogoneria.branch");

    return NextResponse.json({ user, accessToken });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status >= 400 ? error.status : 502 },
      );
    }
    return NextResponse.json(
      { message: "No se pudo iniciar sesión. Inténtalo de nuevo." },
      { status: 502 },
    );
  }
}

export async function DELETE() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete("fogoneria.role");
  store.delete("fogoneria.branch");
  return new NextResponse(null, { status: 204 });
}
