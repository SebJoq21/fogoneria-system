import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateOrderDto } from './create-order.dto.js';

const PLATO = '11111111-1111-4111-8111-111111111111';
const COMBO = '22222222-2222-4222-8222-222222222222';
const MESA = '33333333-3333-4333-8333-333333333333';

async function errores(plain: Record<string, unknown>) {
  const errores = await validate(plainToInstance(CreateOrderDto, plain));
  return errores.map((error) => error.property);
}

describe('CreateOrderDto', () => {
  it('acepta una comanda con platos y combos', async () => {
    expect(
      await errores({
        mesaId: MESA,
        origen: 'MESA',
        items: [
          { tipo: 'PLATO', platoId: PLATO, cantidad: 2, notas: 'Sin ají' },
          { tipo: 'COMBO', comboId: COMBO, cantidad: 1 },
        ],
      }),
    ).toEqual([]);
  });

  it('acepta la sucursal para el admin sin mesa', async () => {
    expect(
      await errores({
        sucursalId: MESA,
        items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1 }],
      }),
    ).toEqual([]);
  });

  it('acepta un cupón sin precio', async () => {
    expect(
      await errores({
        mesaId: MESA,
        cuponCodigo: 'PARRILLA10',
        items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1 }],
      }),
    ).toEqual([]);
  });

  it('rechaza una comanda sin ítems', async () => {
    expect(await errores({ mesaId: MESA, items: [] })).toContain('items');
  });

  it('rechaza ítems incoherentes', async () => {
    expect(
      await errores({ mesaId: MESA, items: [{ tipo: 'PLATO', cantidad: 1 }] }),
    ).toContain('items');
    expect(
      await errores({ mesaId: MESA, items: [{ tipo: 'COMBO', cantidad: 1 }] }),
    ).toContain('items');
  });

  it('rechaza cantidades fuera de rango', async () => {
    expect(
      await errores({ mesaId: MESA, items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 0 }] }),
    ).toContain('items');
  });
});
