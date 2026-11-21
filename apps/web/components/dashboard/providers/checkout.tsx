'use client';

/**
 * Hook del coordinador de cobro (F6c2). Vive en la capa compartida y se monta
 * dentro de `ModulesProvider` (debajo de todos los providers) porque necesita
 * ver cuentas, caja, comprobantes, promociones y CRM a la vez.
 *
 * No posee estado: arma los puertos de `lib/checkout.ts` con los contextos y
 * mantiene espejos en refs (actualizados en efectos/event handlers) para que
 * dos clics en el mismo frame no cobren dos veces.
 */

import { useCallback, useEffect, useRef } from 'react';
import { nextReceiptNumber } from '@/lib/domain';
import type { TableAccount } from '@/lib/domain';
import type { Coupon, Receipt } from '@/lib/erp';
import { useAccounts } from '@/features/orders/provider';
import { useCash } from '@/features/cash/provider';
import { useCrm } from '@/features/crm/provider';
import { usePromotions } from '@/features/promotions/provider';
import { useReceipts } from '@/features/receipts/provider';
import { runCheckout, type CheckoutInput, type CheckoutWrites } from '@/lib/checkout';

type UseCheckoutOptions = {
  onCommitted?: (receipt: Receipt, account: TableAccount) => void;
};

export function useCheckout({ onCommitted }: UseCheckoutOptions = {}) {
  const { accounts, setAccounts } = useAccounts();
  const cash = useCash();
  const receiptsCtx = useReceipts();
  const promotions = usePromotions();
  const { coupons, consumeCoupon, restoreCoupon } = promotions;
  const { addPoints } = useCrm();

  /* Espejos síncronos: los efectos los alinean en cada commit y los handlers
     de escritura los actualizan al instante (los closures pueden quedar
     viejos entre dos clics del mismo frame). */
  const accountsRef = useRef(accounts);
  const receiptsRef = useRef(receiptsCtx.receipts);
  const couponsRef = useRef(coupons);
  const paidByAccount = useRef(new Map<string, Receipt>());
  const onCommittedRef = useRef(onCommitted);

  useEffect(() => {
    accountsRef.current = accounts;
    receiptsRef.current = receiptsCtx.receipts;
    couponsRef.current = coupons;
    onCommittedRef.current = onCommitted;
    const paid = paidByAccount.current;
    for (const receipt of receiptsCtx.receipts) {
      if (receipt.status === 'Pagada' && receipt.accountId) {
        paid.set(receipt.accountId, receipt);
      }
    }
  }, [accounts, coupons, onCommitted, receiptsCtx.receipts]);

  const checkoutAccount = useCallback(
    (input: CheckoutInput): Receipt | null => {
      const account = accountsRef.current.find((a) => a.id === input.accountId) ?? null;
      const paidReceipt = paidByAccount.current.get(input.accountId) ?? null;
      const coupon = input.couponCode
        ? (couponsRef.current.find((c) => c.code === input.couponCode) ?? null)
        : null;
      const branchId = account?.branchId ?? '';
      const shiftId = cash.activeShift(branchId)?.id;

      const mirrorCoupons = (next: Coupon[]) => {
        couponsRef.current = next;
      };

      const writes: CheckoutWrites = {
        markAccountPaid: (accountId, patch) => {
          setAccounts((prev) =>
            prev.map((current) =>
              current.id === accountId ? { ...current, ...patch } : current,
            ),
          );
        },
        restoreAccount: (previous) => {
          setAccounts((prev) =>
            prev.map((current) => (current.id === previous.id ? previous : current)),
          );
        },
        addCashMovements: (branch, movements) => cash.addMovements(branch, movements),
        removeCashMovements: (branch, ids) => {
          const remove = new Set(ids);
          cash.setMovements(branch, (current) =>
            current.some((m) => remove.has(m.id))
              ? current.filter((m) => !remove.has(m.id))
              : current,
          );
        },
        addReceipt: (receipt) => {
          receiptsRef.current = [receipt, ...receiptsRef.current];
          receiptsCtx.addReceipt(receipt);
        },
        removeReceipt: (id) => {
          receiptsRef.current = receiptsRef.current.filter((receipt) => receipt.id !== id);
          receiptsCtx.removeReceipt(id);
        },
        consumeCoupon: (code) => {
          mirrorCoupons(
            couponsRef.current.map((c) =>
              c.code === code ? { ...c, used: c.used + 1 } : c,
            ),
          );
          consumeCoupon(code);
        },
        restoreCoupon: (code) => {
          mirrorCoupons(
            couponsRef.current.map((c) =>
              c.code === code ? { ...c, used: Math.max(0, c.used - 1) } : c,
            ),
          );
          restoreCoupon(code);
        },
        addPoints: (customerId, points) => addPoints(customerId, points),
      };

      return runCheckout(
        input,
        {
          account,
          paidReceipt,
          coupon,
          ...(shiftId ? { shiftId } : {}),
          nextReceiptId: nextReceiptNumber(receiptsRef.current, input.receiptType),
        },
        writes,
        {
          afterCommit: (receipt, paidAccount) => {
            paidByAccount.current.set(paidAccount.id, receipt);
            onCommittedRef.current?.(receipt, paidAccount);
          },
        },
      );
    },
    [addPoints, cash, consumeCoupon, receiptsCtx, restoreCoupon, setAccounts],
  );

  return { checkoutAccount };
}
