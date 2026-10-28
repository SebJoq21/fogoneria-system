"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toolbar } from "@/components/ui/Toolbar";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { AddItemModal } from "./AddItemModal";
import { useNow } from "@/components/useNow";
import {
  accountTotals,
  elapsedLabel,
  fmtMoney,
  itemLineTotal,
  type TableAccount,
} from "@/lib/domain";
import { canAnnulAccount, canCreateOrder, canOpenAccount } from "@/lib/permissions";

/** Panel de una cuenta abierta: líneas, envío a cocina y totales. */
export function AccountPanel({ account, onBack }: { account: TableAccount; onBack: () => void }) {
  const {
    currentUser,
    updateAccountItem,
    removeAccountItem,
    addAccountItems,
    sendToKitchen,
    annulAccount,
    notify,
  } = useModules();
  useNow(30000);
  const role = currentUser?.role;
  const [adding, setAdding] = useState(false);
  const [pendingSend, setPendingSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [pendingAnnul, setPendingAnnul] = useState(false);

  const unsent = account.items.filter((i) => !i.sent);
  const totals = accountTotals(account);
  const canEdit = canOpenAccount(role) && account.status === "abierta";
  const canSend = canCreateOrder(role) && account.status === "abierta";

  /**
   * La comanda se crea en la API (AYCDS-25): el diálogo se cierra antes de
   * esperar la respuesta y el panel muestra el envío en curso o el error.
   */
  const send = () => {
    setPendingSend(false);
    setSendError(null);
    setSending(true);
    void sendToKitchen(account.id)
      .then((order) => {
        if (order) notify("Comanda enviada", `${order.id} · ${account.label}`);
      })
      .catch((error: unknown) => {
        setSendError(
          error instanceof Error ? error.message : "No se pudo enviar la comanda.",
        );
      })
      .finally(() => setSending(false));
  };

  return (
    <div>
      <Toolbar
        left={
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onBack} className="px-3">
              ← Cuentas
            </Button>
            <div>
              <h3 className="text-sm font-medium text-ink-900">{account.label}</h3>
              <p className="text-xs text-ink-400">
                {account.customer || "Sin nombre"} · mesero {account.waiter} · abierta{" "}
                {elapsedLabel(account.openedAt)}
              </p>
            </div>
          </div>
        }
        right={
          canEdit ? (
            <div className="flex gap-2">
              {canAnnulAccount(role) && (
                <Button variant="secondary" onClick={() => setPendingAnnul(true)}>
                  Anular cuenta
                </Button>
              )}
              <Button onClick={() => setAdding(true)}>+ Agregar plato</Button>
            </div>
          ) : undefined
        }
      />

      {account.status !== "abierta" && (
        <p className="text-xs text-ink-400 mb-4">
          Cuenta {account.status}
          {account.motivoAnulacion ? ` · ${account.motivoAnulacion}` : ""}. Vista de lectura.
        </p>
      )}
      {!canEdit && account.status === "abierta" && (
        <p className="text-xs text-ink-400 mb-4">
          Vista de lectura: el mesero edita la cuenta y la sucursal cobra en Caja.
        </p>
      )}

      {account.items.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-400">
            Sin platos todavía. Agrega el primer pedido del comensal.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {account.items.map((item) => (
            <Card key={item.id} as="article">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900">
                    {item.name}
                    <span className="text-ink-400 font-normal"> · {fmtMoney(item.unitPrice)} c/u</span>
                  </p>
                  {item.modifiers.length > 0 && (
                    <p className="text-xs text-ink-600 mt-0.5">
                      {item.modifiers.map((m) => m.name + (m.extra > 0 ? ` +${fmtMoney(m.extra)}` : "")).join(" · ")}
                    </p>
                  )}
                  {item.notes && <p className="text-xs text-ink-400 mt-0.5">“{item.notes}”</p>}
                  <p className="text-xs text-ink-400 mt-0.5">
                    {item.sent ? "Enviado a cocina" : "Pendiente de enviar"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="secondary"
                        className="w-8 h-8 px-0 min-h-0"
                        onClick={() => updateAccountItem(account.id, item.id, Math.max(1, item.qty - 1))}
                        aria-label={`Restar ${item.name}`}
                      >
                        −
                      </Button>
                      <span className="w-6 text-center text-sm font-medium tnum">{item.qty}</span>
                      <Button
                        variant="secondary"
                        className="w-8 h-8 px-0 min-h-0"
                        onClick={() => updateAccountItem(account.id, item.id, item.qty + 1)}
                        aria-label={`Sumar ${item.name}`}
                      >
                        +
                      </Button>
                    </div>
                  )}
                  <span className="text-sm font-medium text-ink-900 tnum w-16 text-right">
                    {fmtMoney(itemLineTotal(item))}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setPendingRemove(item.id)}
                      className="text-ink-400 hover:text-persimmon-600 text-sm px-1 cursor-pointer"
                      aria-label={`Quitar ${item.name}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-ink-400">
              {account.items.length} línea(s) · subtotal {fmtMoney(totals.subtotal)}
              {totals.discount > 0 && ` · descuento ${fmtMoney(totals.discount)}`}
            </p>
            <p className="text-lg font-medium text-ink-900 tnum">{fmtMoney(totals.total)}</p>
          </div>
          {canSend && (
            <Button
              disabled={unsent.length === 0 || sending}
              onClick={() => setPendingSend(true)}
            >
              {sending
                ? "Enviando…"
                : `Enviar a cocina${unsent.length > 0 ? ` (${unsent.length})` : ""}`}
            </Button>
          )}
        </div>
        {sendError && (
          <p className="text-xs text-persimmon-600 mt-2" role="alert">
            {sendError}
          </p>
        )}
        {!canSend && account.status === "abierta" && (
          <p className="text-xs text-ink-400 mt-2">
            El cobro se realiza en Caja, con el turno de caja abierto.
          </p>
        )}
      </Card>

      {adding && (
        <AddItemModal
          onAdd={(item) => addAccountItems(account.id, [item])}
          onClose={() => setAdding(false)}
        />
      )}
      <ConfirmDialog
        open={pendingSend}
        title="Enviar a cocina"
        message={`¿Enviar ${unsent.length} plato(s) a cocina por ${fmtMoney(
          unsent.reduce((s, i) => s + itemLineTotal(i), 0),
        )}?`}
        confirmLabel="Enviar"
        onConfirm={send}
        onCancel={() => setPendingSend(false)}
      />
      <ConfirmDialog
        open={pendingRemove !== null}
        title="Quitar plato"
        message="¿Quitar esta línea de la cuenta? Si ya fue a cocina, coordina la anulación con cocina."
        confirmLabel="Quitar"
        danger
        onConfirm={() => {
          if (pendingRemove) removeAccountItem(account.id, pendingRemove);
          setPendingRemove(null);
        }}
        onCancel={() => setPendingRemove(null)}
      />
      <ConfirmDialog
        open={pendingAnnul}
        title="Anular cuenta"
        message={`¿Anular la cuenta ${account.label}? Se libera la mesa y no se puede deshacer.`}
        confirmLabel="Anular cuenta"
        danger
        onConfirm={() => {
          annulAccount(account.id, "Anulada desde el panel");
          notify("Cuenta anulada", `${account.label} · mesa liberada`);
          setPendingAnnul(false);
          onBack();
        }}
        onCancel={() => setPendingAnnul(false)}
      />
    </div>
  );
}
