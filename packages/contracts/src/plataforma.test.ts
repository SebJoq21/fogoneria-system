import { describe, expect, it } from 'vitest';
import {
  ESTADOS_EMPRESA,
  PLANES_EMPRESA,
  ROLES_WEB,
  esEstadoEmpresa,
  esPlanEmpresa,
  esRolWeb,
  estadoEmpresaTone,
  etiquetaEstadoEmpresa,
  etiquetaPlan,
  etiquetaRol,
  isValidEmail,
  isValidRuc,
  rolDesdeApi,
  toOnboardingPayload,
  validarOnboarding,
} from './plataforma';
import type { OnboardingInput } from './plataforma';

describe('isValidEmail', () => {
  it('acepta correos razonables', () => {
    expect(isValidEmail('admin@mirestaurante.com')).toBe(true);
    expect(isValidEmail('a+b@sub.dominio.pe')).toBe(true);
    expect(isValidEmail('  admin@mirestaurante.com  ')).toBe(true);
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
      'a\tb@c.com',
      'a\nb@c.com',
      'a\rb@c.com',
      `${'x'.repeat(65)}@dominio.com`,
      `a@${'x'.repeat(250)}.com`,
    ]) {
      expect(isValidEmail(value)).toBe(false);
    }
  });
});

describe('isValidRuc', () => {
  it('acepta RUC con dígito verificador correcto', () => {
    expect(isValidRuc('20123456786')).toBe(true);
    expect(isValidRuc(' 20123456786 ')).toBe(true);
  });

  it('rechaza longitud, formato y dígito incorrectos', () => {
    expect(isValidRuc('')).toBe(false);
    expect(isValidRuc('12345678')).toBe(false);
    expect(isValidRuc('2012345678a')).toBe(false);
    expect(isValidRuc('20123456789')).toBe(false);
  });
});

describe('roles de la web', () => {
  it('reconoce los roles del shell', () => {
    for (const rol of ROLES_WEB) expect(esRolWeb(rol)).toBe(true);
    expect(esRolWeb('ADMIN_GLOBAL')).toBe(false);
  });

  it('mapea el rol de la API y rechaza desconocidos', () => {
    expect(rolDesdeApi('SUPERADMIN')).toBe('superadmin');
    expect(rolDesdeApi('ADMIN_GLOBAL')).toBe('admin');
    expect(rolDesdeApi('GERENTE_SUCURSAL')).toBe('sucursal');
    expect(rolDesdeApi('CAJERO')).toBe('cajero');
    expect(rolDesdeApi('COCINERO')).toBe('cocina');
    expect(rolDesdeApi('MESERO')).toBe('mesero');
    expect(rolDesdeApi('OTRO')).toBeNull();
  });

  it('etiqueta cada rol', () => {
    expect(etiquetaRol('superadmin')).toBe('Superadmin SaaS');
    expect(etiquetaRol('admin')).toBe('Dueño franquicia');
    expect(etiquetaRol('sucursal')).toBe('Admin sucursal');
    expect(etiquetaRol('cajero')).toBe('Cajero');
    expect(etiquetaRol('cocina')).toBe('Cocina');
    expect(etiquetaRol('mesero')).toBe('Mesero');
  });
});

describe('estados y planes de empresa', () => {
  it('reconoce estados y planes declarados', () => {
    for (const estado of ESTADOS_EMPRESA) expect(esEstadoEmpresa(estado)).toBe(true);
    expect(esEstadoEmpresa('activa')).toBe(false);
    for (const plan of PLANES_EMPRESA) expect(esPlanEmpresa(plan)).toBe(true);
    expect(esPlanEmpresa('ENTERPRISE')).toBe(false);
  });

  it('traduce el estado para la consola SaaS', () => {
    expect(etiquetaEstadoEmpresa('ACTIVE')).toBe('Activa');
    expect(etiquetaEstadoEmpresa('SUSPENDED')).toBe('Suspendida');
    expect(etiquetaEstadoEmpresa('TRIAL')).toBe('Trial');
    expect(etiquetaEstadoEmpresa('EXPIRED')).toBe('Expirada');
    expect(etiquetaEstadoEmpresa('LEAD')).toBe('Lead');
    expect(etiquetaEstadoEmpresa('NO_CALIFICADO')).toBe('Lead');
  });

  it('traduce el plan y asigna su tono', () => {
    expect(etiquetaPlan('TRIAL')).toBe('Trial');
    expect(etiquetaPlan('BASICO')).toBe('Básico');
    expect(etiquetaPlan('PROFESIONAL')).toBe('Profesional');
    expect(etiquetaPlan('OTRO')).toBe('Trial');
    expect(estadoEmpresaTone('ACTIVE')).toBe('success');
    expect(estadoEmpresaTone('TRIAL')).toBe('warning');
    expect(estadoEmpresaTone('SUSPENDED')).toBe('danger');
    expect(estadoEmpresaTone('LEAD')).toBe('danger');
  });
});

const onboarding: OnboardingInput = {
  nombreLegal: 'Fogonería SAC',
  nombreComercial: 'Fogonería',
  ruc: '20123456786',
  sucursalNombre: 'Matriz',
  telefono: '999888777',
  rangoSucursales: 'UNO',
  nombreAdmin: 'Ana Pérez',
  emailAdmin: 'ana@fogoneria.pe',
  password: 'secreta123',
};

describe('validarOnboarding', () => {
  it('acepta un formulario completo y válido', () => {
    expect(validarOnboarding(onboarding)).toBeNull();
    expect(validarOnboarding({ ...onboarding, rangoSucursales: undefined })).toBeNull();
  });

  it('rechaza razón social corta', () => {
    expect(validarOnboarding({ ...onboarding, nombreLegal: '  ' })).toBe(
      'Ingresa la razón social del negocio.',
    );
  });

  it('rechaza RUC inválido', () => {
    expect(validarOnboarding({ ...onboarding, ruc: '123' })).toBe(
      'El RUC debe tener 11 dígitos y ser válido.',
    );
  });

  it('rechaza administrador, correo o contraseña inválidos', () => {
    expect(validarOnboarding({ ...onboarding, nombreAdmin: ' A ' })).toBe(
      'Ingresa el nombre del administrador.',
    );
    expect(validarOnboarding({ ...onboarding, emailAdmin: 'no-es-correo' })).toBe(
      'Ingresa un correo válido.',
    );
    expect(validarOnboarding({ ...onboarding, password: '1234567' })).toBe(
      'La contraseña debe tener al menos 8 caracteres.',
    );
  });

  it('rechaza un rango de sucursales fuera del catálogo', () => {
    expect(
      validarOnboarding({ ...onboarding, rangoSucursales: 'CIEN' as never }),
    ).toBe('Elige un rango de locales válido.');
  });
});

describe('toOnboardingPayload', () => {
  it('recorta los obligatorios y descarta opcionales vacíos', () => {
    const payload = toOnboardingPayload({
      nombreLegal: '  Fogonería SAC ',
      nombreComercial: '   ',
      ruc: ' 20123456786 ',
      logoUrl: '',
      sucursalNombre: ' Matriz ',
      telefono: '',
      nombreAdmin: ' Ana ',
      emailAdmin: ' ana@fogoneria.pe ',
      password: 'secreta123',
      notas: '  ',
    });
    expect(payload).toEqual({
      nombreLegal: 'Fogonería SAC',
      ruc: '20123456786',
      nombreAdmin: 'Ana',
      emailAdmin: 'ana@fogoneria.pe',
      password: 'secreta123',
      sucursalNombre: 'Matriz',
    });
  });

  it('conserva los opcionales con valor y el rango', () => {
    const payload = toOnboardingPayload(onboarding);
    expect(payload).toEqual(onboarding);
  });
});
