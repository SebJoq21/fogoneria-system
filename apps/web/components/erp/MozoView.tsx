"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Select, TextInput } from "@/components/ui/fields";
import { Modal } from "@/components/ui/Modal";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { AccountPanel } from "./mozo/AccountPanel";
import { accountTotals, elapsedLabel, fmtMoney } from "@/lib/domain";
import type { Order } from "@/lib/erp";
import {
  canAnularPendiente,
  canMarkEntregado,
  canOpenAccount,
} from "@/lib/permissions";

/** Panel del mesero: cuentas por mesa (POS) y estados de sus comandas. */
export function MozoView() {
  const {
    currentUser,
    accounts,
    openAccount,
    orders,
    setOrders,
    tables,
    notify,
  } = useModules();
  const me = currentUser?.name ?? "Mesero";
  const role = currentUser?.role;
  const canDeliver = canMarkEntregado(role);
  const canOpen = canOpenAccount(role);

  const [tab, setTab] = useState<"cuentas" | "estados">("cuentas");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [mesaId, setMesaId] = useState("");
  const [customer, setCustomer] = useState("");
  const [pendingAnular, setPendingAnular] = useState<Order | null>(null);
  const [pendingDeliver, setPendingDeliver] = useState<Order | null>(null);

  const selected = accounts.find((a) => a.id === selectedId) ?? null;
  const openAccounts = accounts.filter((a) => a.status === "abierta");
  const mine = orders.filter((o) => o.waiter === me && o.status !== "anulado");

  const createAccount = () => {
    const table = tables.find((t) => String(t.id) === mesaId) ?? null;
    const id = openAccount({
      tableId: table?.id ?? null,
      label: table?.label ?? "Para llevar",
      customer: customer.trim(),
      waiter: me,
    });
    if (id) {
      notify("Cuenta abierta", `${table?.label ?? "Para llevar"} · ${me}`);
      setSelectedId(id);
    }
    setNewOpen(false);
    setMesaId("");
    setCustomer("");
  };

  const anular = (order: Order) => {
    if (!canAnularPendiente(role, order, me)) return;
    setOrders(orders.map((o) => (o.id === order.id ? { ...o, status: "anulado" as const, motivoAnulacion: "Anulado por el mesero" } : o)));
    setPendingAnular(null);
    notify("Comanda anulada", `${order.id} · ${order.customer}`);
  };

  const markDelivered = (order: Order) => {
    if (!canDeliver || order.status !== "listo") return;
    setOrders(orders.map((o) => (o.id === order.id ? { ...o, status: "entregado" as const } : o)));
    notify("Comanda entregada", `${order.id} · el cobro se realiza en Caja`);
    setPendingDeliver(null);
  };

  if (selected) {
    return <AccountPanel account={selected} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex gap-2" role="tablist" aria-label="Panel del mesero">
          {(["cuentas", "estados"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-5 min-h-12 rounded-full text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                tab === t
                  ? "bg-primary text-white"
                  : "bg-surface text-ink-600 border border-ink-900/15 hover:border-ink-900"
              }`}
            >
              {t === "cuentas" ? "Cuentas" : "Mis comandas"}
            </button>
          ))}
        </div>
        {tab === "cuentas" && canOpen && (
          <Button onClick={() => setNewOpen(true)} className="min-h-12">
            + Nueva cuenta
          </Button>
        )}
      </div>

      {tab === "cuentas" ? (
        openAccounts.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-400">
              No hay cuentas abiertas. Abre una cuenta por mesa o para llevar para empezar a
              pedir.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {openAccounts.map((a) => {
              const totals = accountTotals(a);
              return (
                <Card key={a.id} as="article">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-ink-900">{a.label}</span>
                    <Badge tone="warning" dot>
                      Abierta
                    </Badge>
                  </div>
                  <p className="text-nav text-ink-600 mb-2">
                    {a.customer || "Consumidor final"} · {elapsedLabel(a.openedAt)}
                  </p>
                  <p className="text-xs text-ink-400 mb-3">
                    {a.items.length} plato(s) · mesero {a.waiter}
                  </p>
                  <div className="flex items-center justify-between pt-3 border-t border-ink-900/[0.06]">
                    <span className="text-sm font-medium text-ink-900 tnum">
                      {fmtMoney(totals.total)}
                    </span>
                    <Button onClick={() => setSelectedId(a.id)} className="min-h-12 text-sm">
                      Abrir cuenta
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : mine.length === 0 ? (
        <p className="text-sm text-ink-400">Aún no tomaste comandas en este turno.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mine.map((o) => (
            <Card key={o.id} as="article">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-ink-900">{o.id}</span>
                <Badge
                  tone={
                    o.status === "listo"
                      ? "success"
                      : o.status === "pendiente"
                        ? "neutral"
                        : o.status === "cocina"
                          ? "warning"
                          : "neutral"
                  }
                  dot
                >
                  {o.status === "pendiente"
                    ? "Por confirmar"
                    : o.status === "cocina"
                      ? "En cocina"
                      : o.status === "listo"
                        ? "Lista"
                        : "Entregada"}
                </Badge>
              </div>
              <p className="text-nav text-ink-600 mb-2">
                {o.customer} · {o.time}
              </p>
              <ul className="text-sm text-ink-900">
                {o.items.map((it, i) => (
                  <li key={i}>
                    <span className="font-medium">{it.qty}×</span> {it.name}
                    {it.modifiers && it.modifiers.length > 0 && (
                      <span className="text-ink-400"> · {it.modifiers.join(", ")}</span>
                    )}
                  </li>
                ))}
              </ul>
              {o.status === "pendiente" && canAnularPendiente(role, o, me) && (
                <button
                  type="button"
                  onClick={() => setPendingAnular(o)}
                  className="mt-3 text-nav font-medium text-ink-400 hover:text-ink-900 cursor-pointer min-h-12 w-full text-left"
                >
                  Anular comanda
                </button>
              )}
              {o.status === "listo" && canDeliver && (
                <Button onClick={() => setPendingDeliver(o)} className="mt-3 w-full min-h-12 text-sm">
                  Marcar entregado
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {newOpen && (
        <Modal
          onClose={() => setNewOpen(false)}
          title="Nueva cuenta"
          footer={
            <>
              <Button variant="ghost" onClick={() => setNewOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={createAccount}>Abrir cuenta</Button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4">
            <Field label="Mesa" hint="Sin mesa seleccionada = pedido para llevar.">
              <Select value={mesaId} onChange={(e) => setMesaId(e.target.value)}>
                <option value="">Para llevar</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} · {t.zone} · {t.status}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Cliente (opcional)">
              <TextInput
                type="text"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Ej. Juan Pérez"
              />
            </Field>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={pendingDeliver !== null}
        title="Marcar entregado"
        message={
          pendingDeliver
            ? `¿Marcar ${pendingDeliver.id} como entregada? El cobro se registra después en Caja.`
            : ""
        }
        confirmLabel="Marcar entregado"
        onConfirm={() => pendingDeliver && markDelivered(pendingDeliver)}
        onCancel={() => setPendingDeliver(null)}
      />
      <ConfirmDialog
        open={pendingAnular !== null}
        title="Anular comanda"
        message={
          pendingAnular
            ? `¿Anular la comanda ${pendingAnular.id}? Queda registrada como anulada (auditoría).`
            : ""
        }
        confirmLabel="Anular"
        danger
        onConfirm={() => pendingAnular && anular(pendingAnular)}
        onCancel={() => setPendingAnular(null)}
      />
    </div>
  );
}
