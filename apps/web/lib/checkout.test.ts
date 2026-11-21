import { describe, expect, it, vi } from 'vitest';
import { runCheckout, type CheckoutContext, type CheckoutInput, type CheckoutWrites } from './checkout';
import type { TableAccount } from './domain';
import type { Coupon, Receipt } from './erp';

const AT = '2026-11-21T12:00:00.000Z';

function cuenta(overrides: Partial<TableAccount> = {}): TableAccount {
  return {
    id: 'CT-1',
    branchId: 'b-1',
    tableId: 1,
    tableApiId: null,
    label: 'Mesa 1',
    customer: 'Ana',
    waiter: 'Luis',
    openedAt: AT,
    closedAt: null,
    status: 'abierta',
    items: [
      {
        id: 'it-1',
        productId: 'p-1',
        name: 'Lomo',
        qty: 2,
        unitPrice: 24.9,
        modifiers: [],
        notes: '',
        sent: false,
      },
    ],
    payments: [],
    tip: 0,
    discount: 0,
    discountConcept: '',
    couponCode: null,
    customerId: null,
    motivoAnulacion: null,
    ...overrides,
  };
}

const cupon: Coupon = {
  code: 'C10',
  discount: '10% OFF',
  used: 3,
  limit: 10,
  expires: '30 Nov 2026',
};

const input: CheckoutInput = {
  accountId: 'CT-1',
  payments: [{ method: 'Efectivo', amount: 49.82 }],
  tip: 5,
  couponCode: 'C10',
  customerId: 7,
  receiptType: '03',
  docType: '',
  docNumber: '',
};

function contexto(overrides: Partial<CheckoutContext> = {}): CheckoutContext {
  return {
    account: cuenta(),
    paidReceipt: null,
    coupon: cupon,
    shiftId: 'CH-1',
    nextReceiptId: 'B001-1',
    at: AT,
    ...overrides,
  };
}

type Escrituras = CheckoutWrites & { calls: string[] };

function escrituras(overrides: Partial<CheckoutWrites> = {}): Escrituras {
  const calls: string[] = [];
  const base: CheckoutWrites = {
    markAccountPaid: vi.fn(() => calls.push('markAccountPaid')),
    restoreAccount: vi.fn(() => calls.push('restoreAccount')),
    addCashMovements: vi.fn(() => calls.push('addCashMovements')),
    removeCashMovements: vi.fn(() => calls.push('removeCashMovements')),
    addReceipt: vi.fn(() => calls.push('addReceipt')),
    removeReceipt: vi.fn(() => calls.push('removeReceipt')),
    consumeCoupon: vi.fn(() => calls.push('consumeCoupon')),
    restoreCoupon: vi.fn(() => calls.push('restoreCoupon')),
    addPoints: vi.fn(() => calls.push('addPoints')),
  };
  return { ...base, ...overrides, calls };
}

describe('runCheckout', () => {
  it('cobra en orden cuenta → caja → comprobante → cupón → puntos', () => {
    const writes = escrituras();
    const afterCommit = vi.fn();
    const recibo = runCheckout(input, contexto(), writes, { afterCommit });

    expect(writes.calls).toEqual([
      'markAccountPaid',
      'addCashMovements',
      'addReceipt',
      'consumeCoupon',
      'addPoints',
    ]);
    expect(afterCommit).toHaveBeenCalledTimes(1);
    expect(recibo).toMatchObject({
      id: 'B001-1',
      status: 'Pagada',
      accountId: 'CT-1',
      subtotal: 37.98,
      igv: 6.84,
      total: 44.82,
      estadoSunat: 'en_cola',
    });
    expect(writes.markAccountPaid).toHaveBeenCalledWith(
      'CT-1',
      expect.objectContaining({ status: 'cobrada', tip: 5, discount: 4.98, couponCode: 'C10' }),
    );
    expect(writes.addCashMovements).toHaveBeenCalledWith(
      'b-1',
      [expect.objectContaining({ amount: 49.82, shiftId: 'CH-1', accountId: 'CT-1' })],
    );
    expect(writes.addPoints).toHaveBeenCalledWith(7, 44);
  });

  it('no consume cupón ni puntos si el cobro no los pide', () => {
    const writes = escrituras();
    runCheckout(
      { ...input, couponCode: null, customerId: null },
      contexto({ coupon: null }),
      writes,
    );
    expect(writes.calls).not.toContain('consumeCoupon');
    expect(writes.calls).not.toContain('addPoints');
  });

  it('es idempotente: con comprobante Pagada devuelve el mismo sin escribir', () => {
    const existente = { id: 'B001-9', status: 'Pagada', accountId: 'CT-1' } as Receipt;
    const writes = escrituras();
    const recibo = runCheckout(input, contexto({ paidReceipt: existente }), writes);
    expect(recibo).toBe(existente);
    expect(writes.calls).toEqual([]);
  });

  it('no cobra una cuenta que no está abierta', () => {
    const writes = escrituras();
    expect(runCheckout(input, contexto({ account: null }), writes)).toBeNull();
    expect(
      runCheckout(input, contexto({ account: cuenta({ status: 'cobrada' }) }), writes),
    ).toBeNull();
    expect(writes.calls).toEqual([]);
  });

  it('compensa la cuenta si falla la caja', () => {
    const writes = escrituras({
      addCashMovements: vi.fn(() => {
        throw new Error('caja caída');
      }),
    });
    expect(() => runCheckout(input, contexto(), writes)).toThrow('caja caída');
    expect(writes.restoreAccount).toHaveBeenCalledWith(expect.objectContaining({ id: 'CT-1' }));
    expect(writes.addReceipt).not.toHaveBeenCalled();
    expect(writes.consumeCoupon).not.toHaveBeenCalled();
    expect(writes.addPoints).not.toHaveBeenCalled();
  });

  it('compensa caja y cuenta si falla el comprobante', () => {
    const writes = escrituras({
      addReceipt: vi.fn(() => {
        throw new Error('comprobante caído');
      }),
    });
    expect(() => runCheckout(input, contexto(), writes)).toThrow('comprobante caído');
    expect(writes.restoreAccount).toHaveBeenCalled();
    expect(writes.removeCashMovements).toHaveBeenCalledWith(
      'b-1',
      [expect.any(Number)],
    );
    expect(writes.consumeCoupon).not.toHaveBeenCalled();
  });

  it('compensa comprobante, caja y cuenta si falla el cupón', () => {
    const writes = escrituras({
      consumeCoupon: vi.fn(() => {
        throw new Error('cupón caído');
      }),
    });
    expect(() => runCheckout(input, contexto(), writes)).toThrow('cupón caído');
    expect(writes.removeReceipt).toHaveBeenCalledWith('B001-1');
    expect(writes.removeCashMovements).toHaveBeenCalledTimes(1);
    expect(writes.restoreAccount).toHaveBeenCalled();
    expect(writes.restoreCoupon).not.toHaveBeenCalled();
    expect(writes.addPoints).not.toHaveBeenCalled();
  });

  it('compensa cupón, comprobante, caja y cuenta si falla CRM', () => {
    const writes = escrituras({
      addPoints: vi.fn(() => {
        throw new Error('CRM caído');
      }),
    });
    expect(() => runCheckout(input, contexto(), writes)).toThrow('CRM caído');
    expect(writes.restoreCoupon).toHaveBeenCalledWith('C10');
    expect(writes.removeReceipt).toHaveBeenCalledWith('B001-1');
    expect(writes.removeCashMovements).toHaveBeenCalledTimes(1);
    expect(writes.restoreAccount).toHaveBeenCalled();
  });

  it('no compensa si falla un post-efecto (afterCommit)', () => {
    const writes = escrituras();
    expect(() =>
      runCheckout(input, contexto(), writes, {
        afterCommit: () => {
          throw new Error('SUNAT caído');
        },
      }),
    ).toThrow('SUNAT caído');
    expect(writes.restoreAccount).not.toHaveBeenCalled();
    expect(writes.removeReceipt).not.toHaveBeenCalled();
    expect(writes.removeCashMovements).not.toHaveBeenCalled();
  });
});
