"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Select, TextInput } from "@/components/ui/fields";
import { Modal } from "@/components/ui/Modal";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { AccountPanel } from "./mozo/AccountPanel";
import { useOrdersRealtime } from "./useOrdersRealtime";
import type { RealtimeStatus } from "@/lib/realtime";
import { accountTotals, elapsedLabel, fmtMoney } from "@/lib/domain";
import type { Order } from "@/lib/erp";
import { listTables, type ApiTable } from "@/lib/tables-api";
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
    ordersLoading,
    ordersError,
    refreshOrders,
    advanceOrder,
    tables,
    products,
    priceOf,
    notify,
  } = useModules();
  const me = currentUser?.name ?? "Mesero";
  const role = currentUser?.role;
  const canDeliver = canMarkEntregado(role);
  const canOpen = canOpenAccount(role);
  /** Con sesión real la mesa se elige de la API; en demo, del estado local. */
  const hasSession = Boolean(currentUser?.empresaId);

  const [tab, setTab] = useState<"cuentas" | "estados">("cuentas");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [mesaId, setMesaId] = useState("");
  const [mesaApiId, setMesaApiId] = useState("");
  const [apiTables, setApiTables] = useState<ApiTable[] | null>(null);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [customer, setCustomer] = useState("");
  const [pendingAnular, setPendingAnular] = useState<Order | null>(null);
  const [pendingDeliver, setPendingDeliver] = useState<Order | null>(null);

  const selected = accounts.find((a) => a.id === selectedId) ?? null;
  const openAccounts = accounts.filter((a) => a.status === "abierta");
  /** `mesero_id` del JWT en órdenes reales; el nombre en el modo demo. */
  const mine = orders.filter(
    (o) =>
      o.status !== "anulado" &&
      (o.waiterId ? o.waiterId === currentUser?.id : o.waiter === me),
  );

  /* Cocina o caja cambian el estado: el panel relee la API al recibir el evento. */
  const { status: liveStatus } = useOrdersRealtime(hasSession, () => {
    void refreshOrders();
  });

  /* Mesas reales al abrir el diálogo de cuenta nueva (mesa con UUID de la API). */
  useEffect(() => {
    if (!hasSession || !newOpen) return;
    const controller = new AbortController();
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- carga de mesas al abrir el diálogo */
    setTablesError(null);
    void listTables({ signal: controller.signal })
      .then((list) => {
        if (controller.signal.aborted) return;
        setApiTables(list.filter((table) => table.estado !== "MANTENIMIENTO"));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setApiTables([]);
        setTablesError(
          error instanceof Error ? error.message : "No se pudieron cargar las mesas.",
        );
      });
    return () => controller.abort();
  }, [hasSession, newOpen]);

  const createAccount = () => {
    const apiTable = apiTables?.find((t) => t.id === mesaApiId) ?? null;
    const table = tables.find((t) => String(t.id) === mesaId) ?? null;
    const label = hasSession
      ? apiTable
        ? `Mesa ${apiTable.numero}`
        : "Para llevar"
      : (table?.label ?? "Para llevar");
    const id = openAccount({
      tableId: hasSession ? null : (table?.id ?? null),
      tableApiId: hasSession ? (apiTable?.id ?? null) : null,
      label,
      customer: customer.trim(),
      waiter: me,
    });
    if (id) {
      notify("Cuenta abierta", `${label} · ${me}`);
      setSelectedId(id);
    }
    setNewOpen(false);
    setMesaId("");
    setMesaApiId("");
    setCustomer("");
  };

  /** Precio unitario de un ítem desde PriceList; null si no se puede resolver. */
  const unitPriceOf = (it: Order["items"][number]): number | null => {
    if (it.productId != null) return priceOf(it.productId);
    const found = products.find((p) => p.name === it.name);
    return found ? priceOf(found.id) : null;
  };

  const anular = (order: Order) => {
    if (!canAnularPendiente(role, order, me)) return;
    setPendingAnular(null);
    void advanceOrder(order, "anulado").then((ok) => {
      if (ok) notify("Comanda anulada", `${order.id} · ${order.customer}`);
      else
        notify(
          "No se pudo anular",
          "Una comanda que ya entró a cocina se entrega y se compensa.",
        );
    });
  };

  const markDelivered = (order: Order) => {
    if (!canDeliver || order.status !== "listo") return;
    setPendingDeliver(null);
    void advanceOrder(order, "entregado").then((ok) => {
      if (ok) notify("Comanda entregada", `${order.id} · el cobro se realiza en Caja`);
      else notify("No se pudo marcar entregado", "Revisa el estado de la comanda.");
    });
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
        <div className="flex items-center gap-3">
          {hasSession && (
            <Badge tone={liveTone(liveStatus)} dot>
              {liveLabel(liveStatus)}
            </Badge>
          )}
          {tab === "cuentas" && canOpen && (
            <Button onClick={() => setNewOpen(true)} className="min-h-12">
              + Nueva cuenta
            </Button>
          )}
        </div>
      </div>

      {tab === "estados" && (ordersLoading || ordersError) && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
          {ordersLoading && <p className="text-sm text-ink-400">Cargando comandas…</p>}
          {ordersError && (
            <>
              <p className="text-sm text-persimmon-600" role="alert">
                {ordersError}
              </p>
              <Button variant="secondary" onClick={() => void refreshOrders()}>
                Reintentar
              </Button>
            </>
          )}
        </div>
      )}

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
                {o.items.map((it, i) => {
                  const unit = unitPriceOf(it);
                  return (
                    <li key={i}>
                      <span className="font-medium">{it.qty}×</span> {it.name}
                      {it.modifiers && it.modifiers.length > 0 && (
                        <span className="text-ink-400"> · {it.modifiers.join(", ")}</span>
                      )}
                      {unit != null && <span className="text-ink-400"> · ${unit.toFixed(2)}</span>}
                    </li>
                  );
                })}
              </ul>
              <p className="text-sm font-medium text-ink-900 tnum mt-2">Total {fmtMoney(o.amount)}</p>
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
              <Button onClick={createAccount} disabled={hasSession && apiTables === null}>
                Abrir cuenta
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4">
            {hasSession ? (
              <Field
                label="Mesa"
                hint="Mesas de la sucursal en la API. Sin mesa = pedido para llevar."
              >
                {apiTables === null ? (
                  <p className="text-sm text-ink-400">Cargando mesas…</p>
                ) : (
                  <Select value={mesaApiId} onChange={(e) => setMesaApiId(e.target.value)}>
                    <option value="">Para llevar</option>
                    {apiTables.map((t) => (
                      <option key={t.id} value={t.id}>
                        Mesa {t.numero} · {t.zona ?? "Salón"} · {t.estado.toLowerCase()}
                      </option>
                    ))}
                  </Select>
                )}
                {tablesError && (
                  <p className="text-xs text-persimmon-600 mt-1" role="alert">
                    {tablesError}
                  </p>
                )}
              </Field>
            ) : (
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
            )}
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
            ? `¿Marcar ${pendingDeliver.id} como entregada por ${fmtMoney(pendingDeliver.amount)}? El cobro se registra después en Caja.`
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

function liveLabel(status: RealtimeStatus): string {
  if (status === "connected") return "En vivo";
  if (status === "connecting" || status === "reconnecting") return "Reconectando…";
  return "Sin canal en vivo";
}

function liveTone(status: RealtimeStatus): "success" | "warning" | "neutral" {
  if (status === "connected") return "success";
  if (status === "connecting" || status === "reconnecting") return "warning";
  return "neutral";
}
