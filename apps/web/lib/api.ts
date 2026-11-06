/* Cliente HTTP del navegador. Las llamadas van al BFF (`/api/backend`), que
   adjunta el access token desde una cookie HttpOnly; el token nunca queda
   expuesto a JavaScript. `API_BASE_URL` solo lo usan módulos de servidor
   (BFF y login). */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

const BFF_BASE = "/api/backend";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

function messageFrom(data: unknown, status: number): string {
  if (data && typeof data === "object" && "message" in data) {
    const raw = (data as { message: unknown }).message;
    if (Array.isArray(raw)) return raw.join(". ");
    if (typeof raw === "string" && raw.trim()) return raw;
  }
  if (status === 401) return "Tu sesión expiró. Vuelve a iniciar sesión.";
  return "Ocurrió un error inesperado. Inténtalo de nuevo.";
}

/** Llama al BFF y devuelve el JSON tipado. Lanza `ApiError` si falla. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${BFF_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (error) {
    // Una petición cancelada no es un fallo de conexión.
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    throw new ApiError("No se pudo conectar con el servidor. ¿Está corriendo la API?", 0);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) throw new ApiError(messageFrom(data, response.status), response.status);
  return data as T;
}
