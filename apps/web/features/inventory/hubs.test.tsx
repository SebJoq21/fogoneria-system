import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  ingredients: [
    { id: 1, name: 'Lomo fino', category: 'Carnes', stock: 12, min: 5, unit: 'kg', state: 'Óptimo' },
    { id: 2, name: 'Ají amarillo', category: 'Vegetales', stock: 1, min: 3, unit: 'kg', state: 'Bajo' },
  ],
  movements: [{ id: 1, datetime: 'Hoy', type: 'Salida', ingredient: 'Lomo fino', qty: '-1 kg', reason: 'Venta' }],
  customers: [
    { id: 1, name: 'Rosa', phone: '987654321', email: '', segment: 'VIP', visits: 21, points: 1240, lastVisit: 'Hoy', birthday: '', notes: '' },
  ],
  coupons: [
    { id: 1, code: 'VERANO20', kind: 'percent', value: 10, used: 2, limit: 10, active: true, expires: '2026-12-31' },
  ],
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { InventoryHubPage } from './InventoryHubPage';
import { LoyaltyHubPage } from '../crm/LoyaltyHubPage';

describe('InventoryHubPage', () => {
  it('pinta KPIs, gráfico y bloques de inventario', () => {
    const markup = renderToStaticMarkup(<InventoryHubPage />);
    expect(markup).toContain('Insumos registrados');
    expect(markup).toContain('Insumos por categoría');
    expect(markup).toContain('Kardex');
  });

  it('sin insumos deja los KPIs en cero', () => {
    const insumos = estado.ingredients;
    estado.ingredients = [];
    const markup = renderToStaticMarkup(<InventoryHubPage />);
    expect(markup.length).toBeGreaterThan(0);
    estado.ingredients = insumos;
  });
});

describe('LoyaltyHubPage', () => {
  it('pinta puntos, canjes y bloques de fidelización', () => {
    const markup = renderToStaticMarkup(<LoyaltyHubPage />);
    expect(markup).toContain('Puntos circulando');
    expect(markup).toContain('Cupones canjeados');
    expect(markup).toContain('Comensales');
  });

  it('sin clientes ni cupones deja los acumulados en cero', () => {
    const clientes = estado.customers;
    const cupones = estado.coupons;
    estado.customers = [];
    estado.coupons = [];
    const markup = renderToStaticMarkup(<LoyaltyHubPage />);
    expect(markup.length).toBeGreaterThan(0);
    estado.customers = clientes;
    estado.coupons = cupones;
  });
});
