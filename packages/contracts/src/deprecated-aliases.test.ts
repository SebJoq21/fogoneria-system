import { describe, expect, it } from 'vitest';

import * as cash from './cash';
import * as cashLegacy from './caja';
import * as expenses from './expenses';
import * as expensesLegacy from './gastos';
import * as inventory from './inventory';
import * as inventoryLegacy from './inventario';
import * as orders from './orders';
import * as ordersLegacy from './ordenes';
import * as promotions from './promotions';
import * as promotionsLegacy from './promociones';
import * as receipts from './receipts';
import * as receiptsLegacy from './comprobantes';
import * as staff from './staff';
import * as staffLegacy from './rrhh';

/**
 * Los subpaths antiguos quedan como alias deprecados durante una release.
 * Este test fija que reexportan exactamente el contrato nuevo.
 */
const aliases = [
  ['caja', 'cash', cashLegacy, cash],
  ['comprobantes', 'receipts', receiptsLegacy, receipts],
  ['gastos', 'expenses', expensesLegacy, expenses],
  ['inventario', 'inventory', inventoryLegacy, inventory],
  ['ordenes', 'orders', ordersLegacy, orders],
  ['promociones', 'promotions', promotionsLegacy, promotions],
  ['rrhh', 'staff', staffLegacy, staff],
] as const;

describe('alias deprecados de contratos', () => {
  for (const [legacyName, canonicalName, legacy, canonical] of aliases) {
    it(`./${legacyName} reexporta ./${canonicalName}`, () => {
      expect(Object.keys(legacy).sort()).toEqual(Object.keys(canonical).sort());
    });
  }

  it('los valores son las mismas referencias', () => {
    expect(cashLegacy.etiquetaMetodo).toBe(cash.etiquetaMetodo);
    expect(receiptsLegacy.desgloseIgv).toBe(receipts.desgloseIgv);
    expect(ordersLegacy.estadoKdsDeApi).toBe(orders.estadoKdsDeApi);
    expect(staffLegacy.etiquetaBloque).toBe(staff.etiquetaBloque);
  });
});
