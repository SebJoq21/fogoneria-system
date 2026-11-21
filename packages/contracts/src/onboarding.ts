/**
 * Contrato del alta pública de un restaurante (`POST /onboarding`).
 *
 * Incluye las validaciones de presentación (RUC módulo 11, correo sin regex)
 * que comparte el wizard con la API. Las reglas sensibles (transacción, RLS,
 * rate limit y auditoría) viven en el backend.
 */

import type { PlanEmpresa } from './billing';
import type { EstadoEmpresa } from './tenant';

export type RangoSucursales = 'UNO' | 'DOS_A_TRES' | 'CUATRO_O_MAS';

export const RANGOS_SUCURSALES: readonly RangoSucursales[] = [
  'UNO',
  'DOS_A_TRES',
  'CUATRO_O_MAS',
];

export type OnboardingInput = {
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

export type OnboardingResultado = {
  id: string;
  nombreLegal: string;
  nombreComercial: string | null;
  ruc: string;
  logoUrl: string | null;
  estado: EstadoEmpresa;
  plan: PlanEmpresa;
  trialFin: string | null;
  sucursalMatriz: { id: string; nombre: string };
  admin: { id: string; nombre: string; email: string };
};

/**
 * Valida un RUC peruano de 11 dígitos (módulo 11 SUNAT), igual que la API.
 * Resto 0 → dígito 1; resto 1 → dígito 0.
 */
export function isValidRuc(value: string): boolean {
  const ruc = value.trim();
  if (!/^\d{11}$/.test(ruc)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < weights.length; i += 1) {
    sum += (ruc.charCodeAt(i) - 48) * (weights[i] ?? 0);
  }
  const remainder = sum % 11;
  const checkDigit = (11 - remainder) % 10;
  return checkDigit === Number(ruc[10]);
}

/**
 * Validación de correo sin regex: evita el backtracking que marcan Sonar
 * (S8786) y CodeQL (polynomial ReDoS). Es suficiente para el wizard.
 */
export function isValidEmail(email: string): boolean {
  const value = email.trim();
  if (value.length < 3 || value.length > 254) return false;
  for (const char of value) {
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') return false;
  }
  const at = value.indexOf('@');
  if (at <= 0 || at !== value.lastIndexOf('@')) return false;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (local.length > 64 || !domain || domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) {
    return false;
  }
  return domain.includes('.');
}

/** Error de presentación del wizard; `null` si el paso puede continuar. */
export function validarOnboarding(input: OnboardingInput): string | null {
  if (input.nombreLegal.trim().length < 3) return 'Ingresa la razón social del negocio.';
  if (!isValidRuc(input.ruc)) return 'El RUC debe tener 11 dígitos y ser válido.';
  if (input.nombreAdmin.trim().length < 3) return 'Ingresa el nombre del administrador.';
  if (!isValidEmail(input.emailAdmin)) return 'Ingresa un correo válido.';
  if (input.password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (input.rangoSucursales && !(RANGOS_SUCURSALES as readonly string[]).includes(input.rangoSucursales)) {
    return 'Elige un rango de locales válido.';
  }
  return null;
}

/** Normaliza el formulario: recorta espacios y descarta opcionales vacíos. */
export function toOnboardingPayload(input: OnboardingInput): OnboardingInput {
  const payload: OnboardingInput = {
    nombreLegal: input.nombreLegal.trim(),
    ruc: input.ruc.trim(),
    nombreAdmin: input.nombreAdmin.trim(),
    emailAdmin: input.emailAdmin.trim(),
    password: input.password,
  };
  const opcionales: Array<keyof Pick<
    OnboardingInput,
    | 'nombreComercial'
    | 'logoUrl'
    | 'sucursalNombre'
    | 'telefono'
    | 'notas'
  >> = ['nombreComercial', 'logoUrl', 'sucursalNombre', 'telefono', 'notas'];
  for (const key of opcionales) {
    const value = input[key]?.trim();
    if (value) payload[key] = value;
  }
  if (input.rangoSucursales) payload.rangoSucursales = input.rangoSucursales;
  return payload;
}
