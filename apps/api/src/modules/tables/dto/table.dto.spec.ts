import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  CreateTableDto,
  ListTablesQueryDto,
  MANUAL_TABLE_STATES,
  UpdateTableDto,
  UpdateTableStatusDto,
} from './table.dto.js';

const SUCURSAL = '11111111-1111-4111-8111-111111111111';

async function errores<T extends object>(cls: new () => T, plain: Record<string, unknown>) {
  const errores = await validate(plainToInstance(cls, plain));
  return errores.map((error) => error.property);
}

describe('CreateTableDto', () => {
  it('acepta una mesa completa', async () => {
    expect(
      await errores(CreateTableDto, {
        sucursalId: SUCURSAL,
        numero: '12',
        capacidad: 4,
        zona: 'Salón',
        forma: 'REDONDA',
      }),
    ).toEqual([]);
  });

  it('acepta lo mínimo', async () => {
    expect(await errores(CreateTableDto, { numero: '1', capacidad: 2 })).toEqual([]);
    expect(MANUAL_TABLE_STATES).toEqual(['LIBRE', 'MANTENIMIENTO']);
  });

  it('rechaza número, capacidad, zona, forma y sucursal inválidos', async () => {
    expect(
      await errores(CreateTableDto, {
        sucursalId: 'x',
        numero: '',
        capacidad: 31,
        zona: 'x'.repeat(61),
        forma: 'CUADRADA',
      }),
    ).toEqual(
      expect.arrayContaining(['sucursalId', 'numero', 'capacidad', 'zona', 'forma']),
    );
  });

  it('rechaza capacidad cero o decimal', async () => {
    expect(await errores(CreateTableDto, { numero: '1', capacidad: 0 })).toContain('capacidad');
    expect(await errores(CreateTableDto, { numero: '1', capacidad: 2.5 })).toContain('capacidad');
  });
});

describe('UpdateTableDto', () => {
  it('acepta vacío y campos válidos', async () => {
    expect(await errores(UpdateTableDto, {})).toEqual([]);
    expect(
      await errores(UpdateTableDto, { numero: '9', capacidad: 30, zona: 'Terraza', forma: 'RECTANGULAR' }),
    ).toEqual([]);
  });

  it('rechaza valores fuera de rango', async () => {
    expect(
      await errores(UpdateTableDto, { numero: '12345678901', capacidad: 0, zona: 'x'.repeat(61) }),
    ).toEqual(expect.arrayContaining(['numero', 'capacidad', 'zona']));
  });
});

describe('UpdateTableStatusDto', () => {
  it('solo acepta los estados manuales', async () => {
    expect(await errores(UpdateTableStatusDto, { estado: 'LIBRE' })).toEqual([]);
    expect(await errores(UpdateTableStatusDto, { estado: 'MANTENIMIENTO' })).toEqual([]);
    expect(await errores(UpdateTableStatusDto, { estado: 'OCUPADA' })).toContain('estado');
    expect(await errores(UpdateTableStatusDto, { estado: 'RESERVADA' })).toContain('estado');
  });
});

describe('ListTablesQueryDto', () => {
  it('acepta filtros válidos', async () => {
    expect(
      await errores(ListTablesQueryDto, { estado: 'OCUPADA', zona: 'Salón', sucursalId: SUCURSAL }),
    ).toEqual([]);
  });

  it('rechaza estado y uuid inválidos', async () => {
    expect(
      await errores(ListTablesQueryDto, { estado: 'ROTA', sucursalId: 'x' }),
    ).toEqual(expect.arrayContaining(['estado', 'sucursalId']));
  });
});
