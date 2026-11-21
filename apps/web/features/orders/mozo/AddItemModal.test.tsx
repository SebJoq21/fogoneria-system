import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  products: [
    { id: 'p-1', name: 'Lomo saltado', sku: 'LOM', categoryId: 'c-1', price: 24.9, status: 'Activo', modifierGroupIds: ['g-1'] },
    { id: 'p-2', name: 'Pausado', sku: 'PAU', categoryId: 'c-1', price: 10, status: 'Inactivo', modifierGroupIds: [] },
  ],
  priceOf: (id: string) => (id === 'p-1' ? 24.9 : 0),
  modifierGroups: [
    {
      id: 'g-1',
      name: 'Término',
      required: true,
      multi: false,
      options: [{ id: 'o-1', name: 'Medio', extra: 0 }],
    },
  ],
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { AddItemModal } from './AddItemModal';

describe('AddItemModal', () => {
  it('pinta el catálogo activo y los modificadores del primer plato', () => {
    const markup = renderToStaticMarkup(<AddItemModal onAdd={() => {}} onClose={() => {}} />);
    expect(markup).toContain('Lomo saltado');
    expect(markup).not.toContain('Pausado');
    expect(markup).toContain('Término');
    expect(markup).toContain('Medio');
  });

  it('sin productos activos no deja agregar', () => {
    const productos = estado.products;
    estado.products = [];
    const markup = renderToStaticMarkup(<AddItemModal onAdd={() => {}} onClose={() => {}} />);
    expect(markup).toContain('Agregar');
    expect(markup).toContain('disabled');
    estado.products = productos;
  });
});
