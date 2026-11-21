import { describe, expect, it } from 'vitest';
import {
  mergeById,
  migrateLegacyArray,
  migrateLegacyInventory,
  moduleChannelKey,
  moduleStorageKey,
  type LegacyErpState,
} from './module-store';
import type { ErpState } from './persistence';
import type { Expense, Ingredient, Role, StockMovement } from './erp';

const expense = (id: number, amount: string): Expense => ({
  id,
  date: 'Hoy',
  category: 'Insumos',
  supplier: 'Proveedor',
  amount,
  status: 'Pagado',
});

const ingredients: Ingredient[] = [
  { id: 1, name: 'Sal', category: 'Insumos', stock: 1, min: 1, unit: 'kg', state: 'Óptimo' },
];

const movements: StockMovement[] = [
  { id: 1, datetime: 'Hoy', type: 'Entrada', ingredient: 'Sal', qty: '+1 kg', reason: 'Compra' },
];

const roles: Role[] = [{ id: 'ROL-1', name: 'Admin', description: 'Demo' }];

const state = {
  version: 2,
  reservations: [],
  coupons: [],
  receipts: [],
  combos: [],
  tickets: [],
  scopes: {},
  accounts: [],
  cashShifts: [],
  sunatContingencia: false,
  expenses: [expense(1, '$10.00')],
  ingredients,
  movements,
  roles,
} as unknown as LegacyErpState;

describe('claves por módulo y tenant', () => {
  it('namespaca storage y canal por módulo', () => {
    expect(moduleStorageKey('expenses', 'emp-1')).toBe('fogoneria:expenses:v1:emp-1');
    expect(moduleChannelKey('expenses', 'emp-1')).toBe('fogoneria:expenses-sync:emp-1');
  });
});

describe('mergeById', () => {
  it('deja ganar al valor existente y conserva el resto', () => {
    expect(mergeById([expense(1, '$10.00'), expense(2, '$5.00')], [expense(1, '$99.00')])).toEqual([
      expense(1, '$99.00'),
      expense(2, '$5.00'),
    ]);
  });

  it('tolera null en ambos lados', () => {
    expect(mergeById(null, null)).toEqual([]);
  });
});

describe('migrateLegacyArray', () => {
  it('saca el campo del ErpState y devuelve la lista', () => {
    const result = migrateLegacyArray(state, 'expenses', null);
    expect(result.migrated).toEqual([expense(1, '$10.00')]);
    expect('expenses' in result.state).toBe(false);
    expect('roles' in result.state).toBe(true);
  });

  it('fusiona con la clave del módulo ya migrada', () => {
    const result = migrateLegacyArray(state, 'roles', [roles[0], { id: 'ROL-2', name: 'Mozo', description: 'x' }]);
    expect(result.migrated?.map((role) => role.id)).toEqual(['ROL-1', 'ROL-2']);
  });

  it('sin legacy no migra nada', () => {
    const clean = { ...state } as ErpState;
    delete (clean as LegacyErpState).expenses;
    expect(migrateLegacyArray(clean, 'expenses', null)).toEqual({ state: clean, migrated: null });
  });
});

describe('migrateLegacyInventory', () => {
  it('saca ingredients y movements juntos', () => {
    const result = migrateLegacyInventory(state, null);
    expect(result.migrated).toEqual({ ingredients, movements });
    expect('ingredients' in result.state).toBe(false);
    expect('movements' in result.state).toBe(false);
  });

  it('fusiona por id con el inventario existente', () => {
    const result = migrateLegacyInventory(state, {
      ingredients: [{ ...ingredients[0], stock: 9 }],
      movements: [{ ...movements[0], qty: '+2 kg' }],
    });
    expect(result.migrated?.ingredients[0].stock).toBe(9);
    expect(result.migrated?.movements[0].qty).toBe('+2 kg');
  });

  it('sin legacy no migra nada', () => {
    const clean = { ...state } as ErpState;
    delete (clean as LegacyErpState).ingredients;
    delete (clean as LegacyErpState).movements;
    expect(migrateLegacyInventory(clean, null)).toEqual({ state: clean, migrated: null });
  });
});
