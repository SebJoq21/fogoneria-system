import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateOrderDto } from './create-order.dto.js';

const PLATO = '88888888-8888-8888-8888-888888888881';
const COMBO = '77777777-7777-4777-8777-777777777771';

async function messages(payload: unknown): Promise<string[]> {
  const dto = plainToInstance(CreateOrderDto, payload);
  const errors = await validate(dto, { whitelist: true });
  const out: string[] = [];
  const walk = (list: typeof errors) => {
    for (const error of list) {
      out.push(...Object.values(error.constraints ?? {}));
      if (error.children) walk(error.children);
    }
  };
  walk(errors);
  return out;
}

describe('CreateOrderDto', () => {
  it('rechaza una orden sin items', async () => {
    const errors = await messages({});
    expect(errors.some((message) => message.includes('items'))).toBe(true);
  });

  it('rechaza una lista de items vacía', async () => {
    const errors = await messages({ items: [] });
    expect(errors.some((message) => message.includes('items'))).toBe(true);
  });

  it('rechaza un PLATO sin platoId', async () => {
    const errors = await messages({
      items: [{ tipo: 'PLATO', cantidad: 1, precioUnitario: 10 }],
    });
    expect(errors).toContain('Un ítem PLATO requiere platoId y no debe traer comboId');
  });

  it('rechaza un PLATO con comboId', async () => {
    const errors = await messages({
      items: [{ tipo: 'PLATO', platoId: PLATO, comboId: COMBO, cantidad: 1, precioUnitario: 10 }],
    });
    expect(errors).toContain('Un ítem PLATO requiere platoId y no debe traer comboId');
  });

  it('rechaza un COMBO sin comboId', async () => {
    const errors = await messages({
      items: [{ tipo: 'COMBO', cantidad: 1, precioUnitario: 10 }],
    });
    expect(errors).toContain('Un ítem COMBO requiere comboId y no debe traer platoId');
  });

  it('acepta PLATO y COMBO bien formados', async () => {
    const errors = await messages({
      items: [
        { tipo: 'PLATO', platoId: PLATO, cantidad: 2, precioUnitario: 24.9 },
        { tipo: 'COMBO', comboId: COMBO, cantidad: 1, precioUnitario: 39.9, notas: 'sin ají' },
      ],
    });
    expect(errors).toEqual([]);
  });
});
