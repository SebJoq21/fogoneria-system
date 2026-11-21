/**
 * Coordinador de cobro (F6c2): capa compartida, no feature.
 *
 * Función pura con puertos inyectados: calcula el comprobante, aplica el cobro
 * en orden (cuenta → caja → comprobante → cupón → puntos) y **compensa** los
 * pasos ya aplicados si uno falla. La idempotencia se resuelve antes de tocar
 * nada: si la cuenta ya tiene un comprobante `Pagada`, se devuelve ese mismo.
 *
 * No conoce React ni los providers; el hook `useCheckout` arma los puertos.
 */

import {
  accountTotals,
  fmtDateTime,
  nowIso,
  parseCouponDiscount,
  round2,
  splitIgv,
  type Payment,
  type PaymentMethod,
  type TableAccount,
} from './domain';
import type { CashMovement, Coupon, Receipt, ReceiptType } from './erp';

export type CheckoutInput = {
  accountId: string;
  payments: { method: PaymentMethod; amount: number }[];
  tip: number;
  couponCode: string | null;
  customerId: number | null;
  receiptType: ReceiptType;
  docType: '1' | '6' | '';
  docNumber: string;
};

export type PaidAccountPatch = {
  status: 'cobrada';
  closedAt: string;
  payments: Payment[];
  tip: number;
  discount: number;
  discountConcept: string;
  couponCode: string | null;
  customerId: number | null;
};

export type CheckoutWrites = {
  markAccountPaid: (accountId: string, patch: PaidAccountPatch) => void;
  restoreAccount: (account: TableAccount) => void;
  addCashMovements: (branchId: string, movements: CashMovement[]) => void;
  removeCashMovements: (branchId: string, ids: number[]) => void;
  addReceipt: (receipt: Receipt) => void;
  removeReceipt: (id: string) => void;
  consumeCoupon: (code: string) => void;
  restoreCoupon: (code: string) => void;
  addPoints: (customerId: number, points: number) => void;
  restorePoints: (customerId: number, points: number) => void;
};

export type CheckoutContext = {
  account: TableAccount | null;
  /** Comprobante `Pagada` ya emitido para la cuenta (idempotencia). */
  paidReceipt: Receipt | null;
  coupon: Coupon | null;
  /** Turno abierto de la sucursal (el movimiento queda imputado a él). */
  shiftId?: string;
  /** Correlativo que toca según el estado actual de comprobantes. */
  nextReceiptId: string;
  /** Inyectable en tests; por defecto `nowIso()`. */
  at?: string;
};

export type CheckoutHooks = {
  /**
   * Post-commit: SUNAT, cierre de comandas en la API y liberación de mesa.
   * No se compensa: un fallo aquí no revierte una venta ya cobrada.
   */
  afterCommit?: (receipt: Receipt, account: TableAccount) => void;
};

export function runCheckout(
  input: CheckoutInput,
  context: CheckoutContext,
  writes: CheckoutWrites,
  hooks: CheckoutHooks = {},
): Receipt | null {
  // Idempotencia: un segundo cobro de la misma cuenta devuelve el comprobante
  // original sin escribir nada (protege el doble clic y los reintentos).
  if (context.paidReceipt) return context.paidReceipt;

  const account = context.account;
  if (!account || account.status !== 'abierta') return null;

  const base = accountTotals(account);
  const coupon = context.coupon;
  const discount = coupon ? parseCouponDiscount(coupon, base.subtotal) : 0;
  const total = round2(base.subtotal - discount);
  const { subtotal, igv } = splitIgv(total);
  const at = context.at ?? nowIso();

  const receipt: Receipt = {
    id: context.nextReceiptId,
    type: input.receiptType,
    at,
    date: fmtDateTime(at),
    customer: account.customer || account.label,
    docType: input.docType,
    docNumber: input.docNumber,
    subtotal,
    igv,
    total,
    status: 'Pagada',
    source: `Cuenta ${account.id} · ${account.label}`,
    accountId: account.id,
    estadoSunat: 'en_cola',
    intentosEnvio: 0,
  };

  const payments: Payment[] = input.payments.map((p) => ({
    method: p.method,
    amount: round2(p.amount),
    tip: 0,
    at,
  }));

  const movements: CashMovement[] = input.payments.map((p, i) => ({
    id: Date.now() + i,
    at,
    datetime: fmtDateTime(at),
    concept: `Cobro ${account.label} · ${account.id}`,
    kind: 'Ingreso',
    amount: round2(p.amount),
    method: p.method,
    ...(context.shiftId ? { shiftId: context.shiftId } : {}),
    accountId: account.id,
  }));

  const points = input.customerId ? Math.floor(total) : 0;

  // Aplicación con compensación en orden inverso. El orden es el del contrato:
  // cuenta → caja → comprobante → cupón → puntos (CRM). Los puntos van al final
  // y registran su reverso antes de aplicarse, para compensar un fallo parcial
  // del CRM sin deshacer el cobro ya persistido.
  const undo: Array<() => void> = [];
  try {
    writes.markAccountPaid(account.id, {
      status: 'cobrada',
      closedAt: at,
      payments,
      tip: round2(input.tip),
      discount,
      discountConcept: coupon ? `Cupón ${coupon.code}` : '',
      couponCode: coupon?.code ?? null,
      customerId: input.customerId,
    });
    undo.push(() => writes.restoreAccount(account));

    writes.addCashMovements(account.branchId, movements);
    undo.push(() => writes.removeCashMovements(account.branchId, movements.map((m) => m.id)));

    writes.addReceipt(receipt);
    undo.push(() => writes.removeReceipt(receipt.id));

    if (coupon) {
      writes.consumeCoupon(coupon.code);
      undo.push(() => writes.restoreCoupon(coupon.code));
    }

    if (input.customerId) {
      undo.push(() => writes.restorePoints(input.customerId!, points));
      writes.addPoints(input.customerId, points);
    }
  } catch (error) {
    for (const step of undo.reverse()) {
      try {
        step();
      } catch {
        /* la compensación nunca debe enmascarar el error original */
      }
    }
    throw error;
  }

  hooks.afterCommit?.(receipt, account);
  return receipt;
}
