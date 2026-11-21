'use client';

/**
 * Hook del coordinador de cobro (F6c2/F6c3). Vive en la capa compartida y se
 * monta dentro de `ModulesProvider` (debajo de todos los providers) porque
 * necesita ver cuentas, caja, comprobantes, promociones y CRM a la vez.
 *
 * No posee estado: arma los puertos de `lib/checkout.ts` con los contextos.
 *
 * - Idempotencia (M1): guard `checkingOut` por cuenta + comprobante `Pagada`
 *   por cuenta (mapa que se reconstruye desde el estado, así se limpia al
 *   resetear o cambiar de empresa: L2).
 * - Post-commit (M2): mesa/SUNAT/comandas entran en una cola con reintentos;
 *   nunca forman parte de la compensación del cobro.
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

const MAX_POST_COMMIT_ATTEMPTS = 3;

type UseCheckoutOptions = {
  onCommitted?: (receipt: Receipt, account: TableAccount) => void;
};

type PostCommitTask = { receipt: Receipt; account: TableAccount; attempts: number };

export function useCheckout({ onCommitted }: UseCheckoutOptions = {}) {
  const { accounts, setAccounts } = useAccounts();
  const cash = useCash();
  const receiptsCtx = useReceipts();
  const promotions = usePromotions();
  const { coupons, consumeCoupon, restoreCoupon } = promotions;
  const { addPoints, restorePoints } = useCrm();

  /* Espejos síncronos: los efectos los alinean en cada commit y los handlers
     de escritura los actualizan al instante (los closures pueden quedar
     viejos entre dos clics del mismo frame). */
  const accountsRef = useRef(accounts);
  const receiptsRef = useRef(receiptsCtx.receipts);
  const couponsRef = useRef(coupons);
  const paidByAccount = useRef(new Map<string, Receipt>());
  const checkingOut = useRef(new Set<string>());
  const pendingPostCommit = useRef<PostCommitTask[]>([]);
  const onCommittedRef = useRef(onCommitted);

  useEffect(() => {
    accountsRef.current = accounts;
    receiptsRef.current = receiptsCtx.receipts;
    couponsRef.current = coupons;
    onCommittedRef.current = onCommitted;
    // Reconstruye el mapa desde el estado: limpia cuentas viejas al resetear
    // o cambiar de empresa (L2) sin perder el alta síncrona del cobro.
    const paid = new Map<string, Receipt>();
    for (const receipt of receiptsCtx.receipts) {
      if (receipt.status === 'Pagada' && receipt.accountId) {
        paid.set(receipt.accountId, receipt);
      }
    }
    paidByAccount.current = paid;
  }, [accounts, coupons, onCommitted, receiptsCtx.receipts]);

  /** Procesa (y reintenta) los post-efectos fuera de la compensación. */
  const flushPostCommit = useCallback(() => {
    const queue = pendingPostCommit.current;
    if (queue.length === 0) return;
    pendingPostCommit.current = [];
    for (const task of queue) {
      try {
        onCommittedRef.current?.(task.receipt, task.account);
      } catch {
        if (task.attempts + 1 < MAX_POST_COMMIT_ATTEMPTS) {
          pendingPostCommit.current.push({ ...task, attempts: task.attempts + 1 });
        }
      }
    }
  }, []);

  useEffect(() => {
    flushPostCommit();
  });

  const checkoutAccount = useCallback(
    (input: CheckoutInput): Receipt | null => {
      // M1: reentrancia (un cobro disparado desde un puerto) se ignora.
      if (checkingOut.current.has(input.accountId)) return null;
      checkingOut.current.add(input.accountId);
      try {
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
          restorePoints: (customerId, points) => restorePoints(customerId, points),
        };

        const receipt = runCheckout(
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
            afterCommit: (created, paidAccount) => {
              paidByAccount.current.set(paidAccount.id, created);
              pendingPostCommit.current.push({
                receipt: created,
                account: paidAccount,
                attempts: 0,
              });
            },
          },
        );
        flushPostCommit();
        return receipt;
      } finally {
        checkingOut.current.delete(input.accountId);
      }
    },
    [
      addPoints,
      cash,
      consumeCoupon,
      flushPostCommit,
      receiptsCtx,
      restoreCoupon,
      restorePoints,
      setAccounts,
    ],
  );

  return { checkoutAccount };
}
