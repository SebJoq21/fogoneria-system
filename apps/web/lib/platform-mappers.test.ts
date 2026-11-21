import { describe, expect, it } from 'vitest';
import {
  esRolWeb,
  etiquetaRol,
  rolDesdeApi,
} from '@fogoneria/contracts/auth';
import {
  esPlanEmpresa,
  etiquetaPlan,
} from '@fogoneria/contracts/billing';
import {
  isValidEmail,
  isValidRuc,
  toOnboardingPayload,
  validarOnboarding,
  type OnboardingInput,
} from '@fogoneria/contracts/onboarding';
import {
  esEstadoEmpresa,
  estadoEmpresaTone,
  etiquetaEstadoEmpresa,
} from '@fogoneria/contracts/tenant';
import {
  toEmpresa,
  toEmpresaSaas,
  toMetricas,
  toOnboardingResultado,
  toSucursal,
  toUsuarioSesion,
  type ApiEmpresa,
  type ApiEmpresaSaas,
  type ApiOnboardingResultado,
  type ApiSucursal,
} from './platform-api';

const onboarding: OnboardingInput = {
  nombreLegal: 'Parrilla El Fuego S.A.C.',
  nombreComercial: 'El Fuego',
  ruc: '20123456786',
  sucursalNombre: 'Sede principal',
  rangoSucursales: 'DOS_A_TRES',
  nombreAdmin: 'María Torres',
  emailAdmin: 'admin@elfuego.pe',
  password: 'Fogoneria123!',
};

const empresaApi: ApiEmpresa = {
  id: 'e-1',
  nombre_legal: 'Parrilla El Fuego S.A.C.',
  nombre_comercial: 'El Fuego',
  ruc: '20123456786',
  estado: 'TRIAL',
  plan_actual: 'BASICO',
  limite_sucursales: 3,
  trial_fin: '2026-12-01T00:00:00.000Z',
  mrr_monto: '149.90',
  totalSucursales: 2,
  totalUsuarios: 7,
};

const sucursalApi: ApiSucursal = {
  id: 's-1',
  nombre: 'Miraflores',
  nombre_corto: null,
  direccion: null,
  telefono: '999888777',
  aforo: null,
  es_matriz: true,
  estado: 'ABIERTA',
};

const empresaSaasApi: ApiEmpresaSaas = {
  id: 'e-1',
  nombre_legal: 'Parrilla El Fuego S.A.C.',
  nombre_comercial: null,
  ruc: '20123456786',
  estado: 'SUSPENDED',
  plan_actual: 'PROFESIONAL',
  mrr_monto: 299,
  _count: { sucursales: 4, usuarios: 12 },
};

const onboardingApi: ApiOnboardingResultado = {
  id: 'e-1',
  nombreLegal: 'Parrilla El Fuego S.A.C.',
  nombreComercial: 'El Fuego',
  ruc: '20123456786',
  logoUrl: null,
  estado: 'TRIAL',
  plan: 'TRIAL',
  trialFin: '2026-12-01T00:00:00.000Z',
  sucursalMatriz: { id: 's-1', nombre: 'Sede principal' },
  admin: { id: 'u-1', nombre: 'María Torres', email: 'admin@elfuego.pe' },
};

describe('validación del RUC', () => {
  it('acepta un RUC SUNAT con dígito correcto y rechaza uno alterado', () => {
    expect(isValidRuc('20123456786')).toBe(true);
    expect(isValidRuc('20123456787')).toBe(false);
    expect(isValidRuc('123')).toBe(false);
  });
});

describe('planes y estados de empresa', () => {
  it('etiqueta los tres planes y los seis estados de la consola', () => {
    expect(etiquetaPlan('TRIAL')).toBe('Trial');
    expect(etiquetaPlan('BASICO')).toBe('Básico');
    expect(etiquetaPlan('PROFESIONAL')).toBe('Profesional');
    expect(etiquetaEstadoEmpresa('ACTIVE')).toBe('Activa');
    expect(etiquetaEstadoEmpresa('SUSPENDED')).toBe('Suspendida');
    expect(etiquetaEstadoEmpresa('EXPIRED')).toBe('Expirada');
    expect(etiquetaEstadoEmpresa('NO_CALIFICADO')).toBe('Lead');
  });

  it('un valor desconocido cae a Trial/Lead y los guards lo rechazan', () => {
    expect(etiquetaPlan('EMPRESA')).toBe('Trial');
    expect(etiquetaEstadoEmpresa('PENDIENTE')).toBe('Lead');
    expect(esPlanEmpresa('BASICO')).toBe(true);
    expect(esPlanEmpresa('EMPRESA')).toBe(false);
    expect(esEstadoEmpresa('ACTIVE')).toBe(true);
    expect(esEstadoEmpresa('PENDIENTE')).toBe(false);
  });

  it('asigna tono de badge: activa verde, trial ámbar, resto rojo', () => {
    expect(estadoEmpresaTone('ACTIVE')).toBe('success');
    expect(estadoEmpresaTone('TRIAL')).toBe('warning');
    expect(estadoEmpresaTone('SUSPENDED')).toBe('danger');
    expect(estadoEmpresaTone('LEAD')).toBe('danger');
  });
});

describe('roles de la sesión', () => {
  it('mapea los roles de la API y rechaza uno desconocido', () => {
    expect(rolDesdeApi('ADMIN_GLOBAL')).toBe('admin');
    expect(rolDesdeApi('GERENTE_SUCURSAL')).toBe('sucursal');
    expect(rolDesdeApi('SUPERADMIN')).toBe('superadmin');
    expect(rolDesdeApi('ROBOT')).toBeNull();
    expect(esRolWeb('cajero')).toBe(true);
    expect(esRolWeb('ROBOT')).toBe(false);
    expect(etiquetaRol('mesero')).toBe('Mesero');
  });

  it('traduce el usuario del login y corta si el rol no es válido', () => {
    expect(
      toUsuarioSesion({
        id: 'u-1',
        nombre: 'Ana Beltrán',
        email: 'mesero@mirestaurante.com',
        rol: 'MESERO',
        empresaId: 'e-1',
        sucursalId: 's-1',
      }),
    ).toEqual({
      id: 'u-1',
      nombre: 'Ana Beltrán',
      email: 'mesero@mirestaurante.com',
      rol: 'mesero',
      empresaId: 'e-1',
      sucursalId: 's-1',
    });
    expect(
      toUsuarioSesion({
        id: 'u-2',
        nombre: 'Robot',
        email: 'robot@example.com',
        rol: 'ROBOT',
        empresaId: null,
        sucursalId: null,
      }),
    ).toBeNull();
  });
});

describe('mapeo del tenant', () => {
  it('traduce la empresa snake_case y convierte el MRR decimal', () => {
    expect(toEmpresa(empresaApi)).toMatchObject({
      id: 'e-1',
      nombreLegal: 'Parrilla El Fuego S.A.C.',
      nombreComercial: 'El Fuego',
      estado: 'TRIAL',
      plan: 'BASICO',
      mrr: 149.9,
      totalSucursales: 2,
      totalUsuarios: 7,
    });
  });

  it('una empresa con estado raro cae a LEAD y ceros', () => {
    const empresa = toEmpresa({
      ...empresaApi,
      estado: 'PENDIENTE',
      plan_actual: 'EMPRESA',
      mrr_monto: null as unknown as string,
    });
    expect(empresa.estado).toBe('LEAD');
    expect(empresa.plan).toBe('TRIAL');
    expect(empresa.mrr).toBe(0);
  });

  it('normaliza la sucursal con nombre corto y estado por defecto', () => {
    expect(toSucursal(sucursalApi)).toMatchObject({
      id: 's-1',
      nombre: 'Miraflores',
      nombreCorto: 'Miraflores',
      direccion: '',
      esMatriz: true,
      estado: 'ABIERTA',
    });
    expect(toSucursal({ ...sucursalApi, estado: 'CERRADA' }).estado).toBe('CERRADA');
  });
});

describe('consola SaaS', () => {
  it('traduce la empresa con sus conteos y el plan', () => {
    expect(toEmpresaSaas(empresaSaasApi)).toEqual({
      id: 'e-1',
      nombreLegal: 'Parrilla El Fuego S.A.C.',
      nombreComercial: null,
      ruc: '20123456786',
      estado: 'SUSPENDED',
      plan: 'PROFESIONAL',
      mrr: 299,
      sucursales: 4,
      usuarios: 12,
    });
  });

  it('normaliza métricas parciales o nulas a cero', () => {
    expect(toMetricas(undefined)).toEqual({
      empresas: { total: 0, trial: 0, active: 0, suspended: 0, expired: 0 },
      mrr: 0,
    });
    expect(
      toMetricas({
        empresas: { total: 5, trial: 2, active: 2, suspended: 1, expired: 0 },
        mrr: '480.50' as unknown as number,
      }),
    ).toMatchObject({ mrr: 480.5, empresas: { total: 5, trial: 2 } });
  });
});

describe('onboarding', () => {
  it('acepta el formulario completo y detecta RUC y contraseña inválidos', () => {
    expect(validarOnboarding(onboarding)).toBeNull();
    expect(validarOnboarding({ ...onboarding, ruc: '20123456787' })).toMatch(/RUC/);
    expect(validarOnboarding({ ...onboarding, password: 'corta' })).toMatch(/contraseña/);
    expect(validarOnboarding({ ...onboarding, emailAdmin: 'sin-arroba' })).toMatch(/correo/);
  });

  it('recorta espacios y descarta opcionales vacíos del payload', () => {
    expect(
      toOnboardingPayload({
        ...onboarding,
        nombreLegal: '  Parrilla El Fuego  ',
        nombreComercial: '   ',
        telefono: '',
        notas: undefined,
        logoUrl: 'https://cdn.fogoneria.pe/logo.png',
      }),
    ).toEqual({
      nombreLegal: 'Parrilla El Fuego',
      ruc: '20123456786',
      nombreAdmin: 'María Torres',
      emailAdmin: 'admin@elfuego.pe',
      password: 'Fogoneria123!',
      logoUrl: 'https://cdn.fogoneria.pe/logo.png',
      sucursalNombre: 'Sede principal',
      rangoSucursales: 'DOS_A_TRES',
    });
  });

  it('traduce el resultado del alta y normaliza estado/plan', () => {
    expect(toOnboardingResultado(onboardingApi)).toMatchObject({
      id: 'e-1',
      estado: 'TRIAL',
      plan: 'TRIAL',
      sucursalMatriz: { id: 's-1', nombre: 'Sede principal' },
      admin: { email: 'admin@elfuego.pe' },
    });
    const raro = toOnboardingResultado({
      ...onboardingApi,
      estado: 'PENDIENTE',
      plan: 'EMPRESA',
    });
    expect(raro.estado).toBe('LEAD');
    expect(raro.plan).toBe('TRIAL');
  });
});

describe('isValidEmail', () => {
  it('acepta correos razonables', () => {
    expect(isValidEmail('admin@mirestaurante.com')).toBe(true);
    expect(isValidEmail('a+b@sub.dominio.pe')).toBe(true);
  });

  it('rechaza correos inválidos', () => {
    for (const value of [
      '',
      'a',
      'a@b',
      '@b.com',
      'a@@b.com',
      'a b@c.com',
      'a@b..com',
      'a@.com',
      'a@b.',
    ]) {
      expect(isValidEmail(value)).toBe(false);
    }
  });
});
