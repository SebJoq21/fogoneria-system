/* Cliente HTTP de la API Fogonería (fase 3: backend real).
   El JWT vive en localStorage; el rol/sucursal siguen en cookies planas
   para que el proxy de Next haga el RBAC optimista. */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

const TOKEN_KEY = "fogoneria:token";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* almacenamiento no disponible */
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Envía el JWT guardado. Por defecto sí; el login y el alta son públicos. */
  auth?: boolean;
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

/** Llama a la API y devuelve el JSON tipado. Lanza `ApiError` si falla. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, signal } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
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
