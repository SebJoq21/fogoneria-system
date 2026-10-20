/* Cliente del BFF de sesión (`/api/session`). El servidor fija las cookies
   HttpOnly; aquí solo se recibe el usuario para el estado de la UI. */

import { ApiError } from "./api";
import type { AppUser } from "./auth";

type SessionResponse = {
  user: AppUser;
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
      cache: "no-store",
    });
  } catch {
    throw new ApiError("No se pudo conectar con el servidor.", 0);
  }

  if (!response.ok) throw new ApiError(await readError(response), response.status);
  return (await response.json()) as SessionResponse;
}

/** El logout real es una navegación a `/api/session/logout` (borra cookies
    HttpOnly y redirige). Se expone aquí para que la UI lo use en un solo lugar. */
export function logoutUrl(): string {
  return "/api/session/logout";
}
