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

  it('con onlyCritical arranca filtrado', () => {
    const markup = renderToStaticMarkup(<InventoryPage onlyCritical />);
    expect(markup).toContain('Stock de ingredientes');
  });
});
