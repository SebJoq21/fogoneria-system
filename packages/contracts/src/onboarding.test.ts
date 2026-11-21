import { describe, expect, it } from 'vitest';
import {
  isValidEmail,
  isValidRuc,
  toOnboardingPayload,
  validarOnboarding,
  type OnboardingInput,
} from './onboarding';

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

describe('contrato de onboarding', () => {
  it('valida RUC módulo 11 y correo sin regex', () => {
    expect(isValidRuc('20123456786')).toBe(true);
    expect(isValidRuc('20123456787')).toBe(false);
    expect(isValidEmail('admin@elfuego.pe')).toBe(true);
    expect(isValidEmail('sin-arroba')).toBe(false);
  });

  it('valida el formulario y normaliza opcionales', () => {
    expect(validarOnboarding(onboarding)).toBeNull();
    expect(validarOnboarding({ ...onboarding, ruc: '20123456787' })).toMatch(/RUC/);
    expect(validarOnboarding({ ...onboarding, password: 'corta' })).toMatch(/contraseña/);
    expect(
      toOnboardingPayload({
        ...onboarding,
        nombreLegal: '  El Fuego  ',
        nombreComercial: '   ',
        telefono: '',
      }),
    ).toMatchObject({ nombreLegal: 'El Fuego', ruc: '20123456786' });
  });
});
