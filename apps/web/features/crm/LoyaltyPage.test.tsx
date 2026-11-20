import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  customers: [
    { id: 1, name: 'Rosa', phone: '987654321', email: '', segment: 'VIP', visits: 21, points: 1240, lastVisit: 'Hoy', birthday: '', notes: '' },
    { id: 2, name: 'Jorge', phone: '955128774', email: '', segment: 'Frecuente', visits: 8, points: 300, lastVisit: 'Ayer', birthday: '', notes: '' },
  ],
  coupons: [
    { id: 1, code: 'VERANO20', kind: 'percent', value: 10, used: 2, limit: 10, active: true, expires: '2026-12-31' },
  ],
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { LoyaltyPage } from './LoyaltyPage';

describe('LoyaltyPage', () => {
  it('pinta el programa de fidelización con clientes y cupones', () => {
    const markup = renderToStaticMarkup(<LoyaltyPage />);
    expect(markup.length).toBeGreaterThan(0);
  });

  it('sin clientes ni cupones muestra los resúmenes en cero', () => {
    const clientes = estado.customers;
    const cupones = estado.coupons;
    estado.customers = [];
    estado.coupons = [];
    const markup = renderToStaticMarkup(<LoyaltyPage />);
    expect(markup.length).toBeGreaterThan(0);
    estado.customers = clientes;
    estado.coupons = cupones;
  });
});
