import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  CreateReceiptDto,
  ListReceiptsQueryDto,
  VoidReceiptDto,
} from './receipts.dto.js';

const ORDEN = '11111111-1111-4111-8111-111111111111';
const SUCURSAL = '22222222-2222-4222-8222-222222222222';

async function errores<T extends object>(cls: new () => T, plain: Record<string, unknown>) {
  const errores = await validate(plainToInstance(cls, plain));
  return errores.map((error) => error.property);
}

describe('CreateReceiptDto', () => {
  it('acepta una boleta con DNI y una factura con RUC', async () => {
    expect(
      await errores(CreateReceiptDto, { ordenId: ORDEN, tipo: 'BOLETA', clienteRef: '12345678' }),
    ).toEqual([]);
    expect(
      await errores(CreateReceiptDto, { ordenId: ORDEN, tipo: 'FACTURA', clienteRef: '20123456786' }),
    ).toEqual([]);
  });

  it('acepta una boleta sin documento', async () => {
    expect(await errores(CreateReceiptDto, { ordenId: ORDEN, tipo: 'BOLETA' })).toEqual([]);
  });

  it('rechaza uuid, tipo y documento inválidos', async () => {
    expect(
      await errores(CreateReceiptDto, { ordenId: 'x', tipo: 'NOTA', clienteRef: 'abc' }),
    ).toEqual(expect.arrayContaining(['ordenId', 'tipo', 'clienteRef']));
  });

  it('rechaza documentos de longitud distinta a 8-11 dígitos', async () => {
    expect(
      await errores(CreateReceiptDto, { ordenId: ORDEN, tipo: 'BOLETA', clienteRef: '1234567' }),
    ).toContain('clienteRef');
    expect(
      await errores(CreateReceiptDto, { ordenId: ORDEN, tipo: 'FACTURA', clienteRef: '123456789012' }),
    ).toContain('clienteRef');
  });
});

describe('VoidReceiptDto', () => {
  it('exige un motivo de 5 a 200 caracteres', async () => {
    expect(await errores(VoidReceiptDto, { motivo: 'Cliente desistió' })).toEqual([]);
    expect(await errores(VoidReceiptDto, {})).toContain('motivo');
    expect(await errores(VoidReceiptDto, { motivo: 'x' })).toContain('motivo');
    expect(await errores(VoidReceiptDto, { motivo: 'x'.repeat(201) })).toContain('motivo');
  });
});

describe('ListReceiptsQueryDto', () => {
  it('acepta la fecha de Lima y los filtros', async () => {
    expect(
      await errores(ListReceiptsQueryDto, {
        fecha: '2026-11-06',
        tipo: 'BOLETA',
        estado: 'PAGADA',
        sucursalId: SUCURSAL,
      }),
    ).toEqual([]);
  });

  it('rechaza fecha con otro formato, enums y uuid inválidos', async () => {
    expect(
      await errores(ListReceiptsQueryDto, {
        fecha: '06/11/2026',
        tipo: 'NOTA',
        estado: 'EMITIDA',
        sucursalId: 'x',
      }),
    ).toEqual(expect.arrayContaining(['fecha', 'tipo', 'estado', 'sucursalId']));
  });
});
