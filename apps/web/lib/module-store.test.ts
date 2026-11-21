import { describe, expect, it } from 'vitest';
import {
  mergeByKey,
  mergeById,
  migrateLegacyArray,
  migrateLegacyCash,
  migrateLegacyInventory,
  migrateLegacyPromotions,
  migrateLegacyReceipts,
  migrateLegacyScopes,
  moduleChannelKey,
  moduleStorageKey,
  type LegacyErpState,
} from './module-store';
import type { ErpState } from './persistence';
import type { CashMovement, Coupon, Expense, Ingredient, Role, StockMovement } from './erp';
import type { CashShift } from './domain';

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
  coupons: [{ code: 'C10', discount: '10% OFF', used: 1, limit: 10, expires: '30 Nov 2026' }],
  receipts: [
    {
      id: 'B001-1',
      type: '03',
      at: '2026-11-21T12:00:00.000Z',
      date: 'Hoy',
      customer: 'Ana',
      docType: '',
      docNumber: '',
      subtotal: 50,
      igv: 9,
      total: 59,
      status: 'Pagada',
      source: 'Mesa 1',
      estadoSunat: 'aceptado',
      intentosEnvio: 1,
    },
  ],
  combos: [{ id: 1, name: 'Combo', description: '', productIds: [], price: 10, status: 'Activo' }],
  tickets: [],
  scopes: {
    miraflores: {
      orders: [],
      tables: [],
      cash: [
        {
          id: 1,
          at: '2026-11-21T12:00:00.000Z',
          datetime: 'Hoy',
          concept: 'Venta',
          kind: 'Ingreso',
          amount: 20,
          method: 'Efectivo',
        },
      ],
    },
  },
  accounts: [],
  cashShifts: [
    {
      id: 'CH-1',
      branchId: 'miraflores',
      status: 'abierto',
      openedBy: 'Rosa',
      openedAt: '2026-11-21T09:00:00.000Z',
      openingFund: 200,
      closedBy: null,
      closedAt: null,
      countedCash: null,
      expectedCash: null,
      difference: null,
      observations: '',
    },
  ],
  sunatContingencia: true,
  expenses: [expense(1, '$10.00')],
  ingredients,
  movements,
  roles,
} as unknown as LegacyErpState;

const legacyCoupons = state.coupons as Coupon[];
const legacyCashShifts = state.cashShifts as CashShift[];
const legacyScopeCash = (
  state.scopes as unknown as Record<string, { cash: CashMovement[] }>
).miraflores.cash;

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

describe('mergeByKey', () => {
  it('fusiona por clave y deja ganar al valor existente', () => {
    const legacy = [legacyCoupons[0], { ...legacyCoupons[0], code: 'OTRO', used: 0 }];
    expect(mergeByKey(legacy, [{ ...legacyCoupons[0], used: 9 }], 'code')).toEqual([
      { ...legacyCoupons[0], used: 9 },
      { ...legacyCoupons[0], code: 'OTRO', used: 0 },
    ]);
  });
});

describe('migrateLegacyCash', () => {
  it('saca turnos y movimientos de caja y deja los scopes sin cash', () => {
    const result = migrateLegacyCash(state, null);
    expect(result.migrated).toMatchObject({
      shifts: [{ id: 'CH-1' }],
      movementsByBranch: { miraflores: [{ id: 1 }] },
    });
    expect('cashShifts' in result.state).toBe(false);
    const scopes = (result.state as unknown as { scopes?: Record<string, { cash?: unknown }> })
      .scopes;
    expect(scopes?.miraflores?.cash).toBeUndefined();
  });

  it('fusiona turnos por id y movimientos por sucursal', () => {
    const result = migrateLegacyCash(state, {
      shifts: [{ ...legacyCashShifts[0], openingFund: 999 }],
      movementsByBranch: { miraflores: [{ ...legacyScopeCash[0], amount: 99 }] },
    });
    expect(result.migrated?.shifts[0].openingFund).toBe(999);
    expect(result.migrated?.movementsByBranch.miraflores[0].amount).toBe(99);
  });

  it('sin legacy no migra nada', () => {
    const clean = { ...state } as ErpState;
    delete (clean as LegacyErpState).cashShifts;
    (clean as unknown as { scopes: Record<string, { orders: []; tables: [] }> }).scopes = {
      miraflores: { orders: [], tables: [] },
    };
    expect(migrateLegacyCash(clean, null)).toEqual({ state: clean, migrated: null });
  });
});

describe('migrateLegacyReceipts', () => {
  it('saca comprobantes y contingencia', () => {
    const result = migrateLegacyReceipts(state, null);
    expect(result.migrated).toMatchObject({
      receipts: [{ id: 'B001-1' }],
      sunatContingencia: true,
    });
    expect('receipts' in result.state).toBe(false);
    expect('sunatContingencia' in result.state).toBe(false);
  });

  it('respeta la contingencia ya migrada', () => {
    const result = migrateLegacyReceipts(state, { receipts: [], sunatContingencia: false });
    expect(result.migrated?.sunatContingencia).toBe(false);
    expect(result.migrated?.receipts).toHaveLength(1);
  });

  it('sin legacy no migra nada', () => {
    const clean = { ...state } as ErpState;
    delete (clean as LegacyErpState).receipts;
    delete (clean as LegacyErpState).sunatContingencia;
    expect(migrateLegacyReceipts(clean, null)).toEqual({ state: clean, migrated: null });
  });
});

describe('migrateLegacyScopes', () => {
  it('saca comandas y mesas y elimina scopes', () => {
    const result = migrateLegacyScopes(state, null, null);
    expect(result.migrated).toEqual({
      ordersByBranch: { miraflores: [] },
      tablesByBranch: { miraflores: [] },
    });
    expect('scopes' in result.state).toBe(false);
  });

  it('fusiona por id con lo ya migrado', () => {
    const resultado = migrateLegacyScopes(
      state,
      { miraflores: [{ id: 'ord-1' } as never] },
      { miraflores: [{ id: 5 } as never] },
    );
    expect(resultado.migrated?.ordersByBranch.miraflores).toHaveLength(1);
    expect(resultado.migrated?.tablesByBranch.miraflores).toHaveLength(1);
  });

  it('sin scopes no migra nada', () => {
    const clean = { ...state } as ErpState;
    delete (clean as LegacyErpState).scopes;
    expect(migrateLegacyScopes(clean, null, null)).toEqual({ state: clean, migrated: null });
  });
});

describe('migrateLegacyPromotions', () => {
  it('saca combos y cupones', () => {
    const result = migrateLegacyPromotions(state, null);
    expect(result.migrated?.combos).toHaveLength(1);
    expect(result.migrated?.coupons[0].code).toBe('C10');
    expect('combos' in result.state).toBe(false);
    expect('coupons' in result.state).toBe(false);
  });

  it('fusiona cupones por code', () => {
    const result = migrateLegacyPromotions(state, {
      combos: [],
      coupons: [{ ...legacyCoupons[0], used: 7 }],
    });
    expect(result.migrated?.coupons[0].used).toBe(7);
    expect(result.migrated?.combos).toHaveLength(1);
  });

  it('sin legacy no migra nada', () => {
    const clean = { ...state } as ErpState;
    delete (clean as LegacyErpState).combos;
    delete (clean as LegacyErpState).coupons;
    expect(migrateLegacyPromotions(clean, null)).toEqual({ state: clean, migrated: null });
  });
});
