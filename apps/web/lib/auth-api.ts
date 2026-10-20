/* Login server-side contra la API (tarea 57). Solo lo usa el BFF de sesión:
   devuelve usuario + tenant + access token, que se guarda en cookie HttpOnly. */

import { API_BASE_URL, ApiError } from "./api";
import { appUserFromApi, type ApiLoginUser, type AppUser } from "./auth";

export type ApiLoginTenant = {
  id: string;
  nombre: string;
  estado: string;
  plan: string;
  trialFin: string | null;
};

type ApiLoginResponse = {
  accessToken: string;
  tokenType: string;
  expiresIn: string;
  user: ApiLoginUser;
  tenant: ApiLoginTenant | null;
};

export type LoginResult = {
  user: AppUser;
  tenant: ApiLoginTenant | null;
  accessToken: string;
};

function messageFrom(data: unknown, status: number): string {
  if (data && typeof data === "object" && "message" in data) {
    const raw = (data as { message: unknown }).message;
    if (Array.isArray(raw)) return raw.join(". ");
    if (typeof raw === "string" && raw.trim()) return raw;
  }
  if (status === 401) return "Correo o contraseña incorrectos.";
  return "No se pudo iniciar sesión. Inténtalo de nuevo.";
}

export async function loginRequest(email: string, password: string): Promise<LoginResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      cache: "no-store",
    });
  } catch {
    throw new ApiError("No se pudo conectar con la API. Inténtalo de nuevo.", 0);
  }

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

  const login = data as ApiLoginResponse;
  const user = appUserFromApi(login.user);
  if (!user) {
    throw new ApiError("El usuario no tiene un rol o una sucursal válidos.", 403);
  }
  return { user, tenant: login.tenant, accessToken: login.accessToken };
}
