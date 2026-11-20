import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  products: [{ id: 'p-1', name: 'Lomo', sku: 'LOM', categoryId: 'c-1', price: 24.9 }],
  notify: () => {},
  ingredients: [],
  setIngredients: () => {},
  movements: [],
  setMovements: () => {},
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { InventoryPage } from './InventoryPage';

describe('InventoryPage', () => {
  it('pinta el stock de ingredientes y el semáforo', () => {
    const markup = renderToStaticMarkup(<InventoryPage />);
    expect(markup).toContain('Stock de ingredientes');
    expect(markup).toContain('Stock por estado');
    expect(markup).toContain('Escandallo (ficha técnica)');
  });

  it('con insumos y movimientos pinta filas y el kardex', () => {
    estado.ingredients = [
      { id: 1, name: 'Lomo fino', category: 'Carnes', stock: 12, min: 5, unit: 'kg', state: 'Óptimo' },
      { id: 2, name: 'Ají amarillo', category: 'Vegetales', stock: 1.5, min: 3, unit: 'kg', state: 'Bajo' },
    ] as never;
    estado.movements = [
      { id: 1, datetime: 'Hoy 13:50', type: 'Salida', ingredient: 'Lomo fino', qty: '-1.5 kg', reason: 'Venta' },
    ] as never;
    const markup = renderToStaticMarkup(<InventoryPage />);
    expect(markup).toContain('Lomo fino');
    expect(markup).toContain('Bajo');
    estado.ingredients = [];
    estado.movements = [];
  });

  it('con onlyCritical arranca filtrado', () => {
    const markup = renderToStaticMarkup(<InventoryPage onlyCritical />);
    expect(markup).toContain('Stock de ingredientes');
  });
});
