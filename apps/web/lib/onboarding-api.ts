/* Alta pública de un restaurante (tarea 57): valida el RUC y crea el lead
   + la empresa en TRIAL vía `POST /onboarding`. */

import { apiFetch } from "./api";

export type RangoSucursales = "UNO" | "DOS_A_TRES" | "CUATRO_O_MAS";

export type OnboardingPayload = {
  nombreLegal: string;
  nombreComercial?: string;
  ruc: string;
  logoUrl?: string;
  sucursalNombre?: string;
  telefono?: string;
  rangoSucursales?: RangoSucursales;
  nombreAdmin: string;
  emailAdmin: string;
  password: string;
  notas?: string;
};

export type OnboardingResult = {
  id: string;
  nombreLegal: string;
  nombreComercial: string | null;
  ruc: string;
  logoUrl: string | null;
  estado: string;
  plan: string;
  trialFin: string | null;
  admin: { id: string; nombre: string; email: string };
};

/** Valida un RUC peruano de 11 dígitos (módulo 11), igual que la API. */
export function isValidRuc(value: string): boolean {
  const ruc = value.trim();
  if (!/^\d{11}$/.test(ruc)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(ruc[i]) * weights[i];
  const remainder = sum % 11;
  // Algoritmo SUNAT: (11 - resto) % 10 (resto 0 → 1, resto 1 → 0).
  const checkDigit = (11 - remainder) % 10;
  return checkDigit === Number(ruc[10]);
}

export async function submitOnboarding(payload: OnboardingPayload): Promise<OnboardingResult> {
  return apiFetch<OnboardingResult>("/onboarding", {
    method: "POST",
    body: payload,
  });
}
