import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  CreateExpenseDto,
  ListExpensesQueryDto,
  PayExpenseDto,
  UpdateExpenseDto,
} from './expenses.dto.js';

const SUCURSAL = '11111111-1111-4111-8111-111111111111';
const PROVEEDOR = '22222222-2222-4222-8222-222222222222';

async function errores<T extends object>(cls: new () => T, plain: Record<string, unknown>) {
  const errores = await validate(plainToInstance(cls, plain));
  return errores.map((error) => error.property);
}

describe('CreateExpenseDto', () => {
  it('acepta un gasto completo', async () => {
    expect(
      await errores(CreateExpenseDto, {
        concepto: 'Compra de carbón',
        monto: 350.5,
        categoria: 'INSUMOS',
        sucursalId: SUCURSAL,
        proveedorId: PROVEEDOR,
        vencimiento: '2026-12-15',
      }),
    ).toEqual([]);
  });

  it('acepta lo mínimo', async () => {
    expect(await errores(CreateExpenseDto, { concepto: 'Luz', monto: 200, categoria: 'SERVICIOS' }))
      .toEqual([]);
  });

  it('rechaza concepto largo, monto no positivo y categoría inválida', async () => {
    expect(
      await errores(CreateExpenseDto, {
        concepto: 'x'.repeat(201),
        monto: 0,
        categoria: 'OTRA',
      }),
    ).toEqual(expect.arrayContaining(['concepto', 'monto', 'categoria']));
  });

  it('rechaza uuid y fecha inválidos', async () => {
    expect(
      await errores(CreateExpenseDto, {
        concepto: 'Gas',
        monto: 10,
        categoria: 'OTROS',
        sucursalId: 'x',
        proveedorId: 'x',
        vencimiento: 'no-fecha',
      }),
    ).toEqual(expect.arrayContaining(['sucursalId', 'proveedorId', 'vencimiento']));
  });
});

describe('UpdateExpenseDto', () => {
  it('acepta parciales y rechaza montos inválidos', async () => {
    expect(await errores(UpdateExpenseDto, {})).toEqual([]);
    expect(
      await errores(UpdateExpenseDto, {
        concepto: 'Gas',
        monto: 100,
        categoria: 'INSUMOS',
        proveedorId: PROVEEDOR,
        vencimiento: '2026-12-15',
      }),
    ).toEqual([]);
    expect(await errores(UpdateExpenseDto, { monto: -1 })).toContain('monto');
  });
});

describe('PayExpenseDto', () => {
  it('acepta los métodos de pago del enum', async () => {
    for (const metodo of ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'YAPE']) {
      expect(await errores(PayExpenseDto, { metodo })).toEqual([]);
    }
  });

  it('rechaza un método desconocido', async () => {
    expect(await errores(PayExpenseDto, { metodo: 'BITCOIN' })).toContain('metodo');
  });
});

describe('ListExpensesQueryDto', () => {
  it('acepta filtros válidos y convierte vencidos a booleano', async () => {
    const dto = plainToInstance(ListExpensesQueryDto, {
      estadoPago: 'PENDIENTE',
      categoria: 'INSUMOS',
      vencidos: 'true',
      sucursalId: SUCURSAL,
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.vencidos).toBe(true);
  });

  it('rechaza enums y uuid inválidos', async () => {
    expect(
      await errores(ListExpensesQueryDto, {
        estadoPago: 'ANULADO',
        categoria: 'OTRA',
        sucursalId: 'x',
      }),
    ).toEqual(expect.arrayContaining(['estadoPago', 'categoria', 'sucursalId']));
  });
});
