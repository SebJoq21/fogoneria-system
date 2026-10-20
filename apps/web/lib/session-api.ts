/* Cliente del BFF de sesión (`/api/session`). La cookie HttpOnly la fija el
   servidor; aquí solo se devuelve el usuario y el JWT para las llamadas API. */

import { ApiError } from "./api";
import type { AppUser } from "./auth";

type SessionResponse = {
  user: AppUser;
  accessToken: string;
};

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: unknown };
    if (typeof data.message === "string" && data.message.trim()) return data.message;
  } catch {
    /* respuesta sin JSON */
  }
  return "No se pudo iniciar sesión. Inténtalo de nuevo.";
}

export async function createSession(email: string, password: string): Promise<SessionResponse> {
  let response: Response;
  try {
    response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("No se pudo conectar con el servidor.", 0);
  }

  if (!response.ok) throw new ApiError(await readError(response), response.status);
  return (await response.json()) as SessionResponse;
}

/** Borra la cookie HttpOnly. Nunca lanza: el logout local no debe bloquearse. */
export async function destroySession(): Promise<void> {
  try {
    await fetch("/api/session", { method: "DELETE", credentials: "same-origin" });
  } catch {
    /* sin red: la cookie expirará sola */
  }
}
