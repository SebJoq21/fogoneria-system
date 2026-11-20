import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  ChangePlanDto,
  CreateTenantDto,
  ReactivateTenantDto,
  SuspendTenantDto,
} from './create-tenant.dto.js';
import { ListTenantsQueryDto } from './list-tenants.dto.js';

async function errores<T extends object>(cls: new () => T, plain: Record<string, unknown>) {
  const errores = await validate(plainToInstance(cls, plain));
  return errores.map((error) => error.property);
}

describe('CreateTenantDto', () => {
  const valido = {
    nombreLegal: 'Parrilla El Fuego S.A.C.',
    nombreComercial: 'El Fuego',
    ruc: '20123456786',
    emailAdmin: 'admin@elfuego.pe',
    nombreAdmin: 'María Torres',
    password: 'Fogoneria123!',
    plan: 'PROFESIONAL',
    limiteSucursales: 3,
    sucursalNombre: 'Sede principal',
    trialDias: 14,
  };

  it('acepta un alta completa', async () => {
    expect(await errores(CreateTenantDto, valido)).toEqual([]);
  });

  it('acepta lo mínimo', async () => {
    expect(
      await errores(CreateTenantDto, {
        nombreLegal: 'El Fuego',
        ruc: '20123456786',
        emailAdmin: 'admin@elfuego.pe',
        nombreAdmin: 'Ana',
        password: 'secreta123',
      }),
    ).toEqual([]);
  });

  it('rechaza RUC, correo, contraseña y plan inválidos', async () => {
    expect(
      await errores(CreateTenantDto, {
        ...valido,
        ruc: '123',
        emailAdmin: 'no-correo',
        password: 'corta',
        plan: 'ENTERPRISE',
      }),
    ).toEqual(expect.arrayContaining(['ruc', 'emailAdmin', 'password', 'plan']));
  });

  it('rechaza nombres largos y límites fuera de rango', async () => {
    expect(
      await errores(CreateTenantDto, {
        ...valido,
        nombreLegal: 'x'.repeat(161),
        nombreComercial: 'x'.repeat(161),
        nombreAdmin: 'x'.repeat(161),
        sucursalNombre: 'x'.repeat(121),
        limiteSucursales: 51,
        trialDias: 91,
      }),
    ).toEqual(
      expect.arrayContaining([
        'nombreLegal',
        'nombreComercial',
        'nombreAdmin',
        'sucursalNombre',
        'limiteSucursales',
        'trialDias',
      ]),
    );
  });
});

describe('SuspendTenantDto y ReactivateTenantDto', () => {
  it('la suspensión exige un motivo de 3 a 300 caracteres', async () => {
    expect(await errores(SuspendTenantDto, { motivo: 'Mora' })).toEqual([]);
    expect(await errores(SuspendTenantDto, {})).toContain('motivo');
    expect(await errores(SuspendTenantDto, { motivo: 'x' })).toContain('motivo');
    expect(await errores(SuspendTenantDto, { motivo: 'x'.repeat(301) })).toContain('motivo');
  });

  it('la reactivación acepta un motivo opcional', async () => {
    expect(await errores(ReactivateTenantDto, {})).toEqual([]);
    expect(await errores(ReactivateTenantDto, { motivo: 'Pago regularizado' })).toEqual([]);
    expect(await errores(ReactivateTenantDto, { motivo: 'x'.repeat(301) })).toContain('motivo');
  });
});

describe('ChangePlanDto', () => {
  it('acepta plan y MRR válidos', async () => {
    expect(await errores(ChangePlanDto, { plan: 'PROFESIONAL', mrrMonto: 249.9 })).toEqual([]);
    expect(await errores(ChangePlanDto, { plan: 'TRIAL', mrrMonto: 0 })).toEqual([]);
  });

  it('rechaza plan desconocido y MRR negativo', async () => {
    expect(await errores(ChangePlanDto, { plan: 'ENTERPRISE', mrrMonto: -1 })).toEqual(
      expect.arrayContaining(['plan', 'mrrMonto']),
    );
  });
});

describe('ListTenantsQueryDto', () => {
  it('acepta filtros válidos', async () => {
    expect(
      await errores(ListTenantsQueryDto, { estado: 'TRIAL', q: 'fuego', page: 1, limit: 50 }),
    ).toEqual([]);
  });

  it('rechaza estado y tamaño de página inválidos', async () => {
    expect(await errores(ListTenantsQueryDto, { estado: 'PENDIENTE', limit: 500 })).toEqual(
      expect.arrayContaining(['estado', 'limit']),
    );
  });
});
