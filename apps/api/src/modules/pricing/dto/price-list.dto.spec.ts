import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  CreatePriceListDto,
  PriceItemDto,
  SetPricesDto,
  UpdatePriceListDto,
} from './price-list.dto.js';

const PLATO = '11111111-1111-4111-8111-111111111111';

async function errores<T extends object>(cls: new () => T, plain: Record<string, unknown>) {
  const errores = await validate(plainToInstance(cls, plain));
  return errores.map((error) => error.property);
}

describe('CreatePriceListDto', () => {
  it('acepta nombre, activa y vigencias', async () => {
    expect(
      await errores(CreatePriceListDto, {
        nombre: 'Carta salón',
        activa: true,
        vigenciaDesde: '2026-01-01',
        vigenciaHasta: '2026-12-31',
      }),
    ).toEqual([]);
  });

  it('acepta solo el nombre', async () => {
    expect(await errores(CreatePriceListDto, { nombre: 'Delivery' })).toEqual([]);
  });

  it('rechaza nombre largo, activa no booleana y fechas inválidas', async () => {
    expect(
      await errores(CreatePriceListDto, {
        nombre: 'x'.repeat(121),
        activa: 'si',
        vigenciaDesde: '01/01/2026',
        vigenciaHasta: 'no-fecha',
      }),
    ).toEqual(expect.arrayContaining(['nombre', 'activa', 'vigenciaDesde', 'vigenciaHasta']));
  });

  it('exige nombre', async () => {
    expect(await errores(CreatePriceListDto, {})).toContain('nombre');
  });
});

describe('UpdatePriceListDto', () => {
  it('acepta parciales y rechaza longitudes o tipos inválidos', async () => {
    expect(await errores(UpdatePriceListDto, {})).toEqual([]);
    expect(await errores(UpdatePriceListDto, { nombre: 'Carta', activa: false })).toEqual([]);
    expect(await errores(UpdatePriceListDto, { nombre: 'x'.repeat(121), activa: 1 })).toEqual(
      expect.arrayContaining(['nombre', 'activa']),
    );
  });
});

describe('PriceItemDto y SetPricesDto', () => {
  it('aceptan un ítem y un lote válidos', async () => {
    expect(await errores(PriceItemDto, { platoId: PLATO, precio: 24.9 })).toEqual([]);
    expect(
      await errores(SetPricesDto, {
        items: [
          { platoId: PLATO, precio: 24.9 },
          { platoId: PLATO, precio: 0 },
        ],
      }),
    ).toEqual([]);
  });

  it('rechazan uuid, precio negativo y lote vacío', async () => {
    expect(await errores(PriceItemDto, { platoId: 'x', precio: -1 })).toEqual(
      expect.arrayContaining(['platoId', 'precio']),
    );
    expect(await errores(SetPricesDto, { items: [] })).toContain('items');
    expect(await errores(SetPricesDto, { items: 'x' })).toContain('items');
  });
});
