import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  ComboPlateDto,
  CreateComboDto,
  CreateCouponDto,
  ListCouponsQueryDto,
  UpdateComboDto,
  UpdateCouponDto,
  ValidateCouponDto,
} from './promotions.dto.js';

const PLATO = '11111111-1111-4111-8111-111111111111';

async function errores<T extends object>(cls: new () => T, plain: Record<string, unknown>) {
  const errores = await validate(plainToInstance(cls, plain));
  return errores.map((error) => error.property);
}

describe('ComboPlateDto y CreateComboDto', () => {
  it('acepta un combo con sus platos', async () => {
    expect(
      await errores(CreateComboDto, {
        nombre: 'Combo parrillero',
        descripcion: 'Para dos',
        precioFijo: 45.9,
        platos: [{ platoId: PLATO, cantidad: 1 }],
      }),
    ).toEqual([]);
    expect(await errores(ComboPlateDto, { platoId: PLATO, cantidad: 20 })).toEqual([]);
  });

  it('rechaza platos vacíos, cantidades fuera de rango y precio inválido', async () => {
    expect(
      await errores(CreateComboDto, { nombre: 'Combo', precioFijo: 0, platos: [] }),
    ).toEqual(expect.arrayContaining(['precioFijo', 'platos']));
    expect(await errores(ComboPlateDto, { platoId: 'x', cantidad: 21 })).toEqual(
      expect.arrayContaining(['platoId', 'cantidad']),
    );
  });

  it('la edición acepta parciales y valida el arreglo si viaja', async () => {
    expect(await errores(UpdateComboDto, {})).toEqual([]);
    expect(await errores(UpdateComboDto, { precioFijo: 30, activo: false })).toEqual([]);
    expect(await errores(UpdateComboDto, { platos: [] })).toContain('platos');
  });
});

describe('DTOs de cupones', () => {
  it('acepta un cupón porcentual y uno por monto', async () => {
    expect(
      await errores(CreateCouponDto, {
        codigo: 'VERANO20',
        tipoDescuento: 'PORCENTAJE',
        valor: 10,
        limiteUsos: 100,
        vencimiento: '2026-12-31',
      }),
    ).toEqual([]);
    expect(
      await errores(CreateCouponDto, {
        codigo: 'MENOS-5',
        tipoDescuento: 'MONTO',
        valor: 5,
        limiteUsos: 1,
        vencimiento: '2026-12-31',
      }),
    ).toEqual([]);
  });

  it('rechaza código, tipo, valor, usos y vencimiento inválidos', async () => {
    expect(
      await errores(CreateCouponDto, {
        codigo: 'abc',
        tipoDescuento: 'REGALO',
        valor: 0,
        limiteUsos: 0,
        vencimiento: 'no-fecha',
      }),
    ).toEqual(
      expect.arrayContaining(['codigo', 'tipoDescuento', 'valor', 'limiteUsos', 'vencimiento']),
    );
  });

  it('la edición acepta parciales y validación exige subtotal no negativo', async () => {
    expect(await errores(UpdateCouponDto, {})).toEqual([]);
    expect(await errores(UpdateCouponDto, { valor: 15, limiteUsos: 200 })).toEqual([]);
    expect(await errores(ValidateCouponDto, { subtotal: 120.5 })).toEqual([]);
    expect(await errores(ValidateCouponDto, { subtotal: -1 })).toContain('subtotal');
  });

  it('lista cupones con el filtro activo', async () => {
    const dto = plainToInstance(ListCouponsQueryDto, { activo: 'true' });
    expect(await validate(dto)).toEqual([]);
    expect(dto.activo).toBe(true);
  });
});
