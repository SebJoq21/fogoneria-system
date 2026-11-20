import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  AdjustPointsDto,
  CreateCustomerDto,
  ListCustomersQueryDto,
  ListPointsQueryDto,
  UpdateCustomerDto,
  UpdateLoyaltyConfigDto,
} from './crm.dto.js';

const SUCURSAL = '11111111-1111-4111-8111-111111111111';

async function errores<T extends object>(cls: new () => T, plain: Record<string, unknown>) {
  const errores = await validate(plainToInstance(cls, plain));
  return errores.map((error) => error.property);
}

describe('CreateCustomerDto y UpdateCustomerDto', () => {
  it('acepta nombre y teléfono válidos (con + opcional)', async () => {
    expect(await errores(CreateCustomerDto, { nombre: 'Ana', telefono: '987654321' })).toEqual([]);
    expect(await errores(CreateCustomerDto, { nombre: 'Ana', telefono: '+51987654321' })).toEqual(
      [],
    );
  });

  it('rechaza teléfonos de menos de 6 o más de 15 dígitos y nombre largo', async () => {
    expect(
      await errores(CreateCustomerDto, { nombre: 'x'.repeat(121), telefono: '12345' }),
    ).toEqual(expect.arrayContaining(['nombre', 'telefono']));
    expect(
      await errores(CreateCustomerDto, { nombre: 'Ana', telefono: '1'.repeat(16) }),
    ).toContain('telefono');
    expect(
      await errores(CreateCustomerDto, { nombre: 'Ana', telefono: '98765abc' }),
    ).toContain('telefono');
  });

  it('la edición acepta campos parciales', async () => {
    expect(await errores(UpdateCustomerDto, {})).toEqual([]);
    expect(await errores(UpdateCustomerDto, { nombre: 'Ana', telefono: '987654321' })).toEqual([]);
    expect(await errores(UpdateCustomerDto, { telefono: 'x' })).toContain('telefono');
  });
});

describe('AdjustPointsDto', () => {
  it('acepta un ajuste completo', async () => {
    expect(
      await errores(AdjustPointsDto, {
        tipo: 'CANJE',
        puntos: 10,
        motivo: 'Cortesía',
        sucursalId: SUCURSAL,
      }),
    ).toEqual([]);
  });

  it('rechaza tipo, puntos y uuid inválidos', async () => {
    expect(
      await errores(AdjustPointsDto, { tipo: 'REGALO', puntos: 0, sucursalId: 'x' }),
    ).toEqual(expect.arrayContaining(['tipo', 'puntos', 'sucursalId']));
    expect(await errores(AdjustPointsDto, { tipo: 'GANANCIA', puntos: 2.5 })).toContain('puntos');
    expect(
      await errores(AdjustPointsDto, { tipo: 'GANANCIA', puntos: 1, motivo: 'x'.repeat(201) }),
    ).toContain('motivo');
  });
});

describe('ListCustomersQueryDto y ListPointsQueryDto', () => {
  it('aceptan filtros válidos', async () => {
    expect(
      await errores(ListCustomersQueryDto, { segmento: 'VIP', q: 'rosa', page: 1, limit: 20 }),
    ).toEqual([]);
    expect(await errores(ListPointsQueryDto, { tipo: 'CANJE' })).toEqual([]);
  });

  it('rechazan enums desconocidos y búsqueda larga', async () => {
    expect(
      await errores(ListCustomersQueryDto, { segmento: 'PLATINO', q: 'x'.repeat(61) }),
    ).toEqual(expect.arrayContaining(['segmento', 'q']));
    expect(await errores(ListPointsQueryDto, { tipo: 'REGALO' })).toContain('tipo');
  });
});

describe('UpdateLoyaltyConfigDto', () => {
  it('acepta la configuración completa', async () => {
    expect(
      await errores(UpdateLoyaltyConfigDto, {
        puntosPorMoneda: 1.5,
        caducidadMeses: 12,
        umbralFrecuente: 5,
        umbralVip: 20,
      }),
    ).toEqual([]);
  });

  it('acepta un cuerpo vacío', async () => {
    expect(await errores(UpdateLoyaltyConfigDto, {})).toEqual([]);
  });

  it('rechaza decimales de más, negativos y umbrales fuera de rango', async () => {
    expect(
      await errores(UpdateLoyaltyConfigDto, {
        puntosPorMoneda: 1.555,
        caducidadMeses: 0,
        umbralFrecuente: 0,
        umbralVip: 1,
      }),
    ).toEqual(
      expect.arrayContaining([
        'puntosPorMoneda',
        'caducidadMeses',
        'umbralFrecuente',
        'umbralVip',
      ]),
    );
    expect(await errores(UpdateLoyaltyConfigDto, { puntosPorMoneda: -1 })).toContain(
      'puntosPorMoneda',
    );
  });
});
