import { describe, expect, it } from 'vitest';
import { migrateLegacyCustomers, mergeCustomers, type LegacyErpState } from './crm-storage';
import type { ErpState } from './persistence';

const customer = (id: number, points: number) => ({
  id,
  name: `Cliente ${id}`,
  phone: '999999999',
  points,
  visits: 1,
  segment: 'Nuevo' as const,
  lastVisit: 'Hoy',
});

const state = {
  version: 2,
  roles: [],
  reservations: [],
  ingredients: [],
  movements: [],
  customers: [customer(1, 5)],
  coupons: [],
  receipts: [],
  expenses: [],
  combos: [],
  tickets: [],
  scopes: {},
  accounts: [],
  cashShifts: [],
  sunatContingencia: false,
} as unknown as LegacyErpState;

describe('migrateLegacyCustomers', () => {
  it('saca customers del ErpState y devuelve la lista', () => {
    const result = migrateLegacyCustomers(state);
    expect(result.migrated).toEqual([customer(1, 5)]);
    expect('customers' in result.state).toBe(false);
  });

  it('fusiona por id y deja ganar a la clave CRM existente', () => {
    expect(mergeCustomers([customer(1, 5), customer(2, 1)], [customer(1, 9)])).toEqual([
      customer(1, 9),
      customer(2, 1),
    ]);
  });

  it('sin legacy no migra nada', () => {
    const clean = { ...state } as ErpState;
    delete (clean as LegacyErpState).customers;
    expect(migrateLegacyCustomers(clean)).toEqual({ state: clean, migrated: null });
  });
});
