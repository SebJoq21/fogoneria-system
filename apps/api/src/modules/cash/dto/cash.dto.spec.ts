import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  ChargeOrderDto,
  CloseShiftDto,
  CreateMovementDto,
  ListMovementsQueryDto,
  ListShiftsQueryDto,
  OpenShiftDto,
} from './cash.dto.js';

const ORDEN = '11111111-1111-4111-8111-111111111111';
const SUCURSAL = '22222222-2222-4222-8222-222222222222';

async function errores<T extends object>(cls: new () => T, plain: Record<string, unknown>) {
  const errores = await validate(plainToInstance(cls, plain));
  return errores.map((error) => error.property);
}

describe('OpenShiftDto y CloseShiftDto', () => {
  it('aceptan fondo y conteo válidos', async () => {
    expect(await errores(OpenShiftDto, { fondoApertura: 200, sucursalId: SUCURSAL })).toEqual([]);
    expect(await errores(OpenShiftDto, { fondoApertura: 0 })).toEqual([]);
    expect(
      await errores(CloseShiftDto, { efectivoContado: 850.5, observaciones: 'Cuadra' }),
    ).toEqual([]);
  });

  it('rechazan montos negativos y observaciones largas', async () => {
    expect(await errores(OpenShiftDto, { fondoApertura: -1 })).toContain('fondoApertura');
    expect(await errores(CloseShiftDto, { efectivoContado: -1 })).toContain('efectivoContado');
    expect(
      await errores(CloseShiftDto, { efectivoContado: 1, observaciones: 'x'.repeat(501) }),
    ).toContain('observaciones');
  });
});

describe('CreateMovementDto', () => {
  it('acepta un egreso manual', async () => {
    expect(
      await errores(CreateMovementDto, {
        tipo: 'EGRESO',
        concepto: 'Pago a proveedor',
        monto: 120.4,
        metodo: 'EFECTIVO',
        sucursalId: SUCURSAL,
      }),
    ).toEqual([]);
  });

  it('rechaza tipo, concepto, monto y método inválidos', async () => {
    expect(
      await errores(CreateMovementDto, {
        tipo: 'SALIDA',
        concepto: 'x'.repeat(201),
        monto: 0,
        metodo: 'BITCOIN',
      }),
    ).toEqual(expect.arrayContaining(['tipo', 'concepto', 'monto', 'metodo']));
  });
});

describe('ChargeOrderDto', () => {
  it('acepta un cobro total o parcial con propina', async () => {
    expect(await errores(ChargeOrderDto, { ordenId: ORDEN, metodo: 'EFECTIVO' })).toEqual([]);
    expect(
      await errores(ChargeOrderDto, { ordenId: ORDEN, metodo: 'TARJETA', monto: 36.5, propina: 5 }),
    ).toEqual([]);
  });

  it('rechaza uuid, método, monto y propina inválidos', async () => {
    expect(
      await errores(ChargeOrderDto, {
        ordenId: 'x',
        metodo: 'BITCOIN',
        monto: 0,
        propina: -1,
      }),
    ).toEqual(expect.arrayContaining(['ordenId', 'metodo', 'monto', 'propina']));
  });
});

describe('ListShiftsQueryDto y ListMovementsQueryDto', () => {
  it('aceptan ventanas y filtros válidos', async () => {
    expect(
      await errores(ListShiftsQueryDto, {
        sucursalId: SUCURSAL,
        desde: '2026-11-01',
        hasta: '2026-11-30',
        page: 1,
        limit: 20,
      }),
    ).toEqual([]);
    expect(
      await errores(ListMovementsQueryDto, { turnoId: ORDEN, tipo: 'INGRESO' }),
    ).toEqual([]);
  });

  it('rechazan fechas, uuid y tipo inválidos', async () => {
    expect(
      await errores(ListShiftsQueryDto, { desde: 'x', hasta: 'x', sucursalId: 'x' }),
    ).toEqual(expect.arrayContaining(['desde', 'hasta', 'sucursalId']));
    expect(
      await errores(ListMovementsQueryDto, { turnoId: 'x', tipo: 'SALIDA' }),
    ).toEqual(expect.arrayContaining(['turnoId', 'tipo']));
  });
});
