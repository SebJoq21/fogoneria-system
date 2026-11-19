/**
 * Contrato de plataforma: sesión, tenant y consola SaaS.
 *
 * Es la capa compartida entre la API y la web para login, alta pública de un
 * restaurante y administración de empresas. Los tipos de lectura usan camelCase
 * (lo que consume la UI); el mapeo desde `snake_case` vive en el cliente de la
 * feature. Las reglas sensibles (JWT, bcrypt, rate limit, cron de morosidad y
 * RLS) siguen en la API: aquí solo hay formas y validaciones de presentación.
 */

/* --------------------------------- sesión --------------------------------- */

export type RolWeb = 'superadmin' | 'admin' | 'sucursal' | 'cajero' | 'cocina' | 'mesero';

export const ROLES_WEB: readonly RolWeb[] = [
  'superadmin',
  'admin',
  'sucursal',
  'cajero',
  'cocina',
  'mesero',
];

/** Rol de la API (`rol_usuario`) → rol del shell web. `null` = rechazar. */
const ROL_API: Record<string, RolWeb> = {
  SUPERADMIN: 'superadmin',
  ADMIN_GLOBAL: 'admin',
  GERENTE_SUCURSAL: 'sucursal',
  CAJERO: 'cajero',
  COCINERO: 'cocina',
  MESERO: 'mesero',
};

export function esRolWeb(value: string): value is RolWeb {
  return (ROLES_WEB as readonly string[]).includes(value);
}

export function rolDesdeApi(rol: string): RolWeb | null {
  return ROL_API[rol] ?? null;
}

export function etiquetaRol(rol: RolWeb): string {
  switch (rol) {
    case 'superadmin':
      return 'Superadmin SaaS';
    case 'admin':
      return 'Dueño franquicia';
    case 'sucursal':
      return 'Admin sucursal';
    case 'cajero':
      return 'Cajero';
    case 'cocina':
      return 'Cocina';
    default:
      return 'Mesero';
  }
}

export type UsuarioSesion = {
  id: string;
  nombre: string;
  email: string;
  rol: RolWeb;
  /** Empresa del token; `null` en superadmin sin tenant. */
  empresaId: string | null;
  /** `null` = todas las sucursales (admin/superadmin). */
  sucursalId: string | null;
};

/* --------------------------------- empresa -------------------------------- */

export type EstadoEmpresa =
  | 'LEAD'
  | 'NO_CALIFICADO'
  | 'TRIAL'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'EXPIRED';

export const ESTADOS_EMPRESA: readonly EstadoEmpresa[] = [
  'LEAD',
  'NO_CALIFICADO',
  'TRIAL',
  'ACTIVE',
  'SUSPENDED',
  'EXPIRED',
];

export type PlanEmpresa = 'TRIAL' | 'BASICO' | 'PROFESIONAL';

export const PLANES_EMPRESA: readonly PlanEmpresa[] = ['TRIAL', 'BASICO', 'PROFESIONAL'];

export function esEstadoEmpresa(value: string): value is EstadoEmpresa {
  return (ESTADOS_EMPRESA as readonly string[]).includes(value);
}

export function esPlanEmpresa(value: string): value is PlanEmpresa {
  return (PLANES_EMPRESA as readonly string[]).includes(value);
}

/** Estado que pinta la consola SaaS; `NO_CALIFICADO` se muestra como Lead. */
export type EstadoEmpresaUi = 'Activa' | 'Suspendida' | 'Trial' | 'Expirada' | 'Lead';

export function etiquetaEstadoEmpresa(estado: EstadoEmpresa | string): EstadoEmpresaUi {
  switch (estado) {
    case 'ACTIVE':
      return 'Activa';
    case 'SUSPENDED':
      return 'Suspendida';
    case 'TRIAL':
      return 'Trial';
    case 'EXPIRED':
      return 'Expirada';
    default:
      return 'Lead';
  }
}

export function etiquetaPlan(plan: PlanEmpresa | string): 'Trial' | 'Básico' | 'Profesional' {
  switch (plan) {
    case 'BASICO':
      return 'Básico';
    case 'PROFESIONAL':
      return 'Profesional';
    default:
      return 'Trial';
  }
}

export type TonoEstado = 'success' | 'warning' | 'danger';

export function estadoEmpresaTone(estado: EstadoEmpresa | string): TonoEstado {
  if (estado === 'ACTIVE') return 'success';
  if (estado === 'TRIAL') return 'warning';
  return 'danger';
}

/** Empresa del token (`GET /tenant`), ya normalizada. */
export type Empresa = {
  id: string;
  nombreLegal: string;
  nombreComercial: string | null;
  ruc: string;
  estado: EstadoEmpresa;
  plan: PlanEmpresa;
  limiteSucursales: number;
  trialFin: string | null;
  mrr: number;
  totalSucursales: number;
  totalUsuarios: number;
};

/** Sucursal de la empresa (`GET /tenant/branches`). */
export type Sucursal = {
  id: string;
  nombre: string;
  nombreCorto: string;
  direccion: string;
  telefono: string;
  aforo: number | null;
  esMatriz: boolean;
  estado: 'ABIERTA' | 'CERRADA';
};

/** Empresa de la consola SaaS (`GET /saas/tenants`). */
export type EmpresaSaas = {
  id: string;
  nombreLegal: string;
  nombreComercial: string | null;
  ruc: string;
  estado: EstadoEmpresa;
  plan: PlanEmpresa;
  mrr: number;
  sucursales: number;
  usuarios: number;
};

export type MetricasSaas = {
  empresas: {
    total: number;
    trial: number;
    active: number;
    suspended: number;
    expired: number;
  };
  mrr: number;
};

/* ------------------------------- onboarding ------------------------------- */

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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Error de presentación del wizard; `null` si el paso puede continuar. */
export function validarOnboarding(input: OnboardingInput): string | null {
  if (input.nombreLegal.trim().length < 3) return 'Ingresa la razón social del negocio.';
  if (!isValidRuc(input.ruc)) return 'El RUC debe tener 11 dígitos y ser válido.';
  if (input.nombreAdmin.trim().length < 3) return 'Ingresa el nombre del administrador.';
  if (!EMAIL_PATTERN.test(input.emailAdmin.trim())) return 'Ingresa un correo válido.';
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

/* ---------------------------------- login --------------------------------- */

export type EmpresaSesion = {
  id: string;
  nombre: string;
  estado: EstadoEmpresa;
  plan: PlanEmpresa;
  trialFin: string | null;
};

export type RespuestaLogin = {
  accessToken: string;
  tokenType: string;
  expiresIn: string;
  user: UsuarioSesion;
  tenant: EmpresaSesion | null;
};
