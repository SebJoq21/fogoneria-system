// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TableAccount } from '@/lib/domain';
import type { Receipt } from '@/lib/erp';
import type { CheckoutInput } from '@/lib/checkout';

const sesion = vi.hoisted(() => ({
  currentUser: null as null | { empresaId: string },
}));

vi.mock('@/components/dashboard/providers/session', () => ({
  useSession: () => sesion,
}));

import { useCheckout } from './checkout';
import { AccountsProvider, useAccounts } from '@/features/orders/provider';
import { CashProvider, useCash } from '@/features/cash/provider';
import { CrmProvider } from '@/features/crm/provider';
import { PromotionsProvider } from '@/features/promotions/provider';
import { ReceiptsProvider, useReceipts } from '@/features/receipts/provider';

const onCommitted = vi.fn();

type Harness = {
  checkout?: (input: CheckoutInput) => Receipt | null;
  setAccounts?: React.Dispatch<React.SetStateAction<TableAccount[]>>;
  resetAccounts?: () => void;
  resetReceipts?: () => void;
  receipts?: Receipt[];
  movements?: number;
};

const harness: Harness = {};

function Probe() {
  const checkout = useCheckout({ onCommitted });
  const { setAccounts, resetAccounts } = useAccounts();
  const receiptsCtx = useReceipts();
  const cash = useCash();
  useEffect(() => {
    harness.checkout = checkout.checkoutAccount;
    harness.setAccounts = setAccounts;
    harness.resetAccounts = resetAccounts;
    harness.resetReceipts = receiptsCtx.resetReceipts;
    harness.receipts = receiptsCtx.receipts;
    harness.movements = cash.movementsOf('b-1').length;
  });
  return null;
}

function shell() {
  return (
    <CrmProvider>
      <AccountsProvider>
        <CashProvider>
          <ReceiptsProvider>
            <PromotionsProvider>
              <Probe />
            </PromotionsProvider>
          </ReceiptsProvider>
        </CashProvider>
      </AccountsProvider>
    </CrmProvider>
  );
}

function cuenta(id = 'CT-1'): TableAccount {
  return {
    id,
    branchId: 'b-1',
    tableId: null,
    tableApiId: null,
    label: 'Barra',
    customer: 'Ana',
    waiter: 'Luis',
    openedAt: '2026-11-21T12:00:00.000Z',
    closedAt: null,
    status: 'abierta',
    items: [
      {
        id: 'it-1',
        productId: 'p-1',
        name: 'Lomo',
        qty: 1,
        unitPrice: 25,
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
  };
}

const input = (accountId = 'CT-1'): CheckoutInput => ({
  accountId,
  payments: [{ method: 'Efectivo', amount: 25 }],
  tip: 0,
  couponCode: null,
  customerId: null,
  receiptType: '03',
  docType: '',
  docNumber: '',
});

beforeEach(() => {
  localStorage.clear();
  sesion.currentUser = null;
  onCommitted.mockReset();
});
afterEach(cleanup);

describe('useCheckout', () => {
  it('ignora el doble clic: un comprobante y un movimiento por cuenta', async () => {
    const { rerender } = render(shell());
    await act(async () => {
      harness.setAccounts?.([cuenta()]);
    });
    await act(async () => {
      rerender(shell());
    });
    const recibosBase = harness.receipts?.length ?? 0;

    let primero: Receipt | null = null;
    let segundo: Receipt | null = null;
    act(() => {
      primero = harness.checkout?.(input()) ?? null;
      segundo = harness.checkout?.(input()) ?? null;
    });

    expect(primero).toBeTruthy();
    expect(segundo).toBe(primero);
    expect(harness.receipts).toHaveLength(recibosBase + 1);
    expect(harness.movements).toBe(1);
    expect(onCommitted).toHaveBeenCalledTimes(1);
  });

  it('reintenta el post-commit sin revertir la venta (M2)', async () => {
    const { rerender } = render(shell());
    await act(async () => harness.setAccounts?.([cuenta()]));
    await act(async () => rerender(shell()));
    const recibosBase = harness.receipts?.length ?? 0;

    onCommitted.mockImplementationOnce(() => {
      throw new Error('SUNAT caído');
    });
    act(() => {
      harness.checkout?.(input());
    });
    // El reintento corre en el siguiente render (efecto), dentro del mismo act.
    expect(onCommitted).toHaveBeenCalledTimes(2);
    expect(harness.receipts).toHaveLength(recibosBase + 1);

    await act(async () => rerender(shell()));
    expect(onCommitted).toHaveBeenCalledTimes(2);
    expect(harness.receipts).toHaveLength(recibosBase + 1);
  });

  it('limpia la idempotencia al resetear (L2)', async () => {
    const { rerender } = render(shell());
    await act(async () => harness.setAccounts?.([cuenta()]));
    await act(async () => rerender(shell()));

    let primero: Receipt | null = null;
    act(() => {
      primero = harness.checkout?.(input()) ?? null;
    });
    expect(primero).toBeTruthy();
    const movimientosTrasPrimero = harness.movements ?? 0;

    await act(async () => {
      harness.resetReceipts?.();
      harness.resetAccounts?.();
    });
    await act(async () => rerender(shell()));
    await act(async () => harness.setAccounts?.([cuenta()]));
    await act(async () => rerender(shell()));

    let segundo: Receipt | null = null;
    act(() => {
      segundo = harness.checkout?.(input()) ?? null;
    });
    expect(segundo).toBeTruthy();
    // No devuelve el comprobante anterior: el cobro volvió a ejecutarse.
    expect(segundo).not.toBe(primero);
    expect(harness.movements).toBe(movimientosTrasPrimero + 1);
  });

  it('limpia la idempotencia al cambiar de empresa (L2)', async () => {
    const { rerender } = render(shell());
    await act(async () => harness.setAccounts?.([cuenta()]));
    await act(async () => rerender(shell()));

    let primero: Receipt | null = null;
    act(() => {
      primero = harness.checkout?.(input()) ?? null;
    });
    expect(primero).toBeTruthy();

    sesion.currentUser = { empresaId: 'emp-2' };
    await act(async () => rerender(shell()));
    await waitForEmptyReceipts();
    await act(async () => harness.setAccounts?.([cuenta()]));
    await act(async () => rerender(shell()));

    let segundo: Receipt | null = null;
    act(() => {
      segundo = harness.checkout?.(input()) ?? null;
    });
    expect(segundo).toBeTruthy();
    expect((segundo as Receipt | null)?.id).not.toBe((primero as Receipt | null)?.id);
    expect(harness.receipts).toHaveLength(1);
    expect(harness.receipts?.[0].accountId).toBe('CT-1');
  });
});

async function waitForEmptyReceipts() {
  for (let i = 0; i < 10 && (harness.receipts?.length ?? 0) > 0; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
  expect(harness.receipts).toHaveLength(0);
}
