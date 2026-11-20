import { describe, expect, it } from 'vitest';
import { categoryName, initialCombos, priceOf } from './erp-catalog';
import type { PriceList, ProductCategory } from './erp-catalog';

const activa: PriceList = {
  id: 'l-1',
  name: 'Carta',
  active: true,
  validFrom: '',
  validTo: '',
  prices: { 'p-1': 24.9 },
};
const inactiva: PriceList = { ...activa, id: 'l-2', active: false, prices: { 'p-1': 30 } };

const categorias: ProductCategory[] = [{ id: 'c-1', name: 'Fondos', position: 1 }];

describe('priceOf', () => {
  it('lee la lista activa y cae a la primera si no hay activa', () => {
    expect(priceOf('p-1', [inactiva, activa])).toBe(24.9);
    expect(priceOf('p-1', [inactiva])).toBe(30);
    expect(priceOf('p-2', [activa])).toBe(0);
    expect(priceOf('p-1', [])).toBe(0);
  });
});

describe('categoryName', () => {
  it('devuelve el nombre o un guion', () => {
    expect(categoryName('c-1', categorias)).toBe('Fondos');
    expect(categoryName('c-9', categorias)).toBe('—');
  });
});

describe('combos de ejemplo', () => {
  it('mantienen la forma del ERP (precio fijo y estado)', () => {
    expect(initialCombos.length).toBeGreaterThan(0);
    for (const combo of initialCombos) {
      expect(combo.price).toBeGreaterThan(0);
      expect(combo.productIds.length).toBeGreaterThan(0);
      expect(['Activo', 'Inactivo']).toContain(combo.status);
    }
  });
});
