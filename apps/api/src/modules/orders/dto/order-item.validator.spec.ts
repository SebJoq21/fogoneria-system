import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { IsConsistentOrderItem } from './order-item.validator.js';

class Linea {
  tipo?: string;
  platoId?: string | null;
  comboId?: string | null;

  @IsConsistentOrderItem()
  consistente?: boolean;
}

async function errores(linea: Partial<Linea>): Promise<string[]> {
  const instancia = Object.assign(new Linea(), linea);
  const resultado = await validate(instancia);
  return resultado.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('IsConsistentOrderItem', () => {
  it('acepta PLATO con platoId y COMBO con comboId', async () => {
    await expect(errores({ tipo: 'PLATO', platoId: 'p-1' })).resolves.toEqual([]);
    await expect(errores({ tipo: 'COMBO', comboId: 'c-1' })).resolves.toEqual([]);
  });

  it('rechaza referencias cruzadas con su mensaje', async () => {
    await expect(errores({ tipo: 'PLATO', platoId: 'p-1', comboId: 'c-1' })).resolves.toEqual([
      'Un ítem PLATO requiere platoId y no debe traer comboId',
    ]);
    await expect(errores({ tipo: 'COMBO', comboId: 'c-1', platoId: 'p-1' })).resolves.toEqual([
      'Un ítem COMBO requiere comboId y no debe traer platoId',
    ]);
  });

  it('rechaza un tipo desconocido', async () => {
    await expect(errores({ tipo: 'BEBIDA' })).resolves.toEqual([
      'El ítem debe ser de tipo PLATO o COMBO',
    ]);
    await expect(errores({})).resolves.toEqual(['El ítem debe ser de tipo PLATO o COMBO']);
  });
});
