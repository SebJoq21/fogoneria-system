/* Login real contra la API (tarea 57). Devuelve usuario + tenant y el JWT. */

import { apiFetch } from "./api";
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

export async function loginRequest(email: string, password: string): Promise<LoginResult> {
  const data = await apiFetch<ApiLoginResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: { email: email.trim().toLowerCase(), password },
  });
  return {
    user: appUserFromApi(data.user),
    tenant: data.tenant,
    accessToken: data.accessToken,
  };
}
