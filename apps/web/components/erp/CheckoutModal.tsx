"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/fields";
import { useModules } from "@/components/dashboard/ModulesProvider";
import {
  PAYMENT_METHODS,
  accountTotals,
  fmtMoney,
  isValidDni,
  isValidRuc,
  parseCouponDiscount,
  round2,
  splitIgv,
  type PaymentMethod,
  type TableAccount,
} from "@/lib/domain";
import type { Receipt, ReceiptType } from "@/lib/erp";

type PaymentRow = { method: PaymentMethod; amount: string };

/** Cobro de una cuenta: pagos (mixtos), propina, cupón, fidelización y comprobante. */
export function CheckoutModal({
  account,
  onClose,
}: {
  account: TableAccount;
  onClose: (receipt: Receipt | null) => void;
}) {
  const { coupons, customers, checkoutAccount, openCashShift, notify } = useModules();
  const [receiptType, setReceiptType] = useState<ReceiptType>("03");
  const [docType, setDocType] = useState<"1" | "6" | "">("");
  const [docNumber, setDocNumber] = useState("");
  const [tip, setTip] = useState("0");
  const [couponCode, setCouponCode] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [payments, setPayments] = useState<PaymentRow[]>([
    { method: "Efectivo", amount: accountTotals(account).total.toFixed(2) },
  ]);

  const base = accountTotals(account);
  const coupon = coupons.find((c) => c.code === couponCode) ?? null;
  const discount = coupon ? parseCouponDiscount(coupon, base.subtotal) : 0;
  const total = round2(base.subtotal - discount);
  const tipNum = Math.max(0, Number(tip) || 0);
  const grandTotal = round2(total + tipNum);
  const paid = round2(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0));
  const remaining = round2(grandTotal - paid);
  const { subtotal, igv } = splitIgv(total);

  const docOk =
    docType === "" ||
    (docType === "1" ? isValidDni(docNumber) : isValidRuc(docNumber));
  const typeOk = receiptType === "03" || docType === "6";
  const canConfirm =
    total > 0 && Math.abs(remaining) < 0.01 && docOk && typeOk;

  const completeRemaining = () => {
    if (remaining === 0) return;
    setPayments((prev) => {
      const next = [...prev];
      const last = next.length - 1;
      next[last] = {
        ...next[last],
        amount: round2((Number(next[last].amount) || 0) + remaining).toFixed(2),
      };
      return next;
    });
  };

  const confirm = () => {
    if (!canConfirm) return;
    const receipt = checkoutAccount({
      accountId: account.id,
      payments: payments.map((p) => ({ method: p.method, amount: Number(p.amount) || 0 })),
      tip: tipNum,
      couponCode: coupon?.code ?? null,
      customerId: customerId ? Number(customerId) : null,
      receiptType,
      docType,
      docNumber,
    });
    if (receipt) {
      notify(
        "Cuenta cobrada",
        `${account.label} · ${receipt.id} por ${fmtMoney(receipt.total)}`,
      );
    }
    onClose(receipt);
  };

  return (
    <Modal
      onClose={() => onClose(null)}
      title={`Cobrar cuenta · ${account.label}`}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={() => onClose(null)}>
            Cancelar
          </Button>
          <Button disabled={!canConfirm} onClick={confirm}>
            Cobrar {fmtMoney(grandTotal)}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 rounded-2xl border border-ink-900/10 p-3">
          <div className="flex justify-between text-nav text-ink-600">
            <span>Subtotal</span>
            <span className="tnum">{fmtMoney(base.subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-nav text-ink-600">
              <span>Descuento {coupon?.code}</span>
              <span className="tnum">-{fmtMoney(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-nav text-ink-600">
            <span>IGV 18% (incluido)</span>
            <span className="tnum">{fmtMoney(igv)}</span>
          </div>
          <div className="flex justify-between text-sm font-medium text-ink-900 mt-1 pt-1 border-t border-ink-900/10">
            <span>Total cuenta</span>
            <span className="tnum">{fmtMoney(total)}</span>
          </div>
          <div className="flex justify-between text-sm font-medium text-ink-900">
            <span>Total a pagar (con propina)</span>
            <span className="tnum">{fmtMoney(grandTotal)}</span>
          </div>
          <p className="text-xs text-ink-400 mt-1">
            Precio de venta: {fmtMoney(subtotal)} + IGV {fmtMoney(igv)}.
          </p>
        </div>

        <div>
          <Field label="Propina (opcional)">
            <TextInput
              type="number"
              min="0"
              step="0.5"
              value={tip}
              onChange={(e) => setTip(e.target.value)}
              placeholder="0.00"
              className="tnum"
            />
          </Field>
        </div>
        <div>
          <Field label="Cupón de descuento">
            <Select value={couponCode} onChange={(e) => setCouponCode(e.target.value)}>
              <option value="">Sin cupón</option>
              {coupons
                .filter((c) => c.used < c.limit)
                .map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.discount}
                  </option>
                ))}
            </Select>
          </Field>
        </div>
        <div>
          <Field label="Cliente (fidelización)">
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Consumidor final</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.points} pts
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div>
          <Field label="Tipo de comprobante">
            <Select
              value={receiptType}
              onChange={(e) => {
                const t = e.target.value as ReceiptType;
                setReceiptType(t);
                if (t === "01") setDocType("6");
                else if (docType === "6") {
                  setDocType("");
                  setDocNumber("");
                }
              }}
            >
              <option value="03">Boleta de venta</option>
              <option value="01">Factura</option>
            </Select>
          </Field>
        </div>
        <div>
          <Field label="Documento del cliente">
            <Select
              value={docType}
              onChange={(e) => {
                setDocType(e.target.value as "1" | "6" | "");
                setDocNumber("");
              }}
            >
              <option value="">Consumidor final</option>
              <option value="1">DNI</option>
              <option value="6">RUC</option>
            </Select>
          </Field>
        </div>
        {docType !== "" && (
          <div className="sm:col-span-2">
            <Field
              label={docType === "1" ? "Número de DNI" : "Número de RUC"}
              hint={
                docNumber && !docOk
                  ? `Documento inválido: ${docType === "1" ? "8 dígitos" : "11 dígitos con dígito verificador SUNAT"}.`
                  : "Se valida antes de emitir (evita rechazos de SUNAT)."
              }
            >
              <TextInput
                type="text"
                inputMode="numeric"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value.replace(/\D/g, ""))}
                placeholder={docType === "1" ? "45678901" : "20123456789"}
                className="tnum"
              />
            </Field>
          </div>
        )}

        <div className="sm:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-nav font-medium text-ink-600">Pagos</span>
            <Button
              variant="secondary"
              className="h-8 px-3 text-xs"
              onClick={() =>
                setPayments((prev) => [...prev, { method: "Yape", amount: "" }])
              }
            >
              + Agregar método
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {payments.map((p, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Select
                  value={p.method}
                  onChange={(e) =>
                    setPayments((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, method: e.target.value as PaymentMethod } : x,
                      ),
                    )
                  }
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
                <TextInput
                  type="number"
                  min="0"
                  step="0.5"
                  value={p.amount}
                  onChange={(e) =>
                    setPayments((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)),
                    )
                  }
                  placeholder="0.00"
                  className="tnum w-28"
                />
                {payments.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPayments((prev) => prev.filter((_, j) => j !== i))}
                    className="text-ink-400 hover:text-ink-900 text-sm px-2 cursor-pointer"
                    aria-label="Quitar método de pago"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className={`text-nav ${Math.abs(remaining) < 0.01 ? "text-ink-400" : "text-persimmon-600"}`}>
              {Math.abs(remaining) < 0.01
                ? `Pagado: ${fmtMoney(paid)}`
                : `Pendiente: ${fmtMoney(remaining)}`}
            </span>
            <Button variant="ghost" className="h-8 px-3 text-xs" onClick={completeRemaining}>
              Completar pendiente
            </Button>
          </div>
        </div>

        {!openCashShift && (
          <p className="sm:col-span-2 text-xs text-persimmon-600">
            No hay turno de caja abierto en esta sucursal: abre turno en Caja para registrar el
            cobro.
          </p>
        )}
      </div>
    </Modal>
  );
}
