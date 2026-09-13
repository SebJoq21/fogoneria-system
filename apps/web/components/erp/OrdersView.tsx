"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type Order, type OrderStatus } from "@/lib/erp";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";
import { ordenesSummary } from "@/components/erp/summaries/summary-selectors";
import { canConfirmRecepcion, canMarkListo, type OrdersMode } from "@/lib/permissions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const columns: { id: OrderStatus; label: string }[] = [
  { id: "pendiente", label: "Por confirmar" },
  { id: "cocina", label: "En cocina" },
  { id: "listo", label: "Listo" },
  { id: "entregado", label: "Entregado" },
];

const demoIncoming: Omit<Order, "id" | "time" | "elapsed" | "status">[] = [
  { customer: "Mesa 5", items: [{ productId: 3, name: "Lomo Saltado", qty: 1 }], total: "$22.00", channel: "Mesa" },
  { customer: "Lucía Prado", items: [{ productId: 1, name: "Ceviche Clásico", qty: 2 }], total: "$30.00", channel: "Web" },
];

export function OrdersView({ mode = "ordenes" }: { mode?: OrdersMode } = {}) {
  const { notify, orders, setOrders, activeBranch, isGeneral, branchOf, currentUser } = useModules();
  const canConfirm = canConfirmRecepcion(currentUser?.role, mode);
  const canListo = canMarkListo(currentUser?.role, mode);
  const [live, setLive] = useState(true);
  const [pendingConfirm, setPendingConfirm] = useState<Order | null>(null);
  const [pendingListo, setPendingListo] = useState<Order | null>(null);
  const seq = useRef(1043);

  // Comandas entrantes simuladas en vivo
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      seq.current -= 1;
      const next = seq.current;
      const tpl = demoIncoming[next % demoIncoming.length];
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        setOrders((prev) => [
          { ...tpl, id: `#PD-${next}`, time, elapsed: "ahora mismo", status: "pendiente" },
          ...prev,
        ]);
        notify("Nueva comanda entrante", `${tpl.customer} · ${tpl.total}`);
    }, 45000);
    return () => clearInterval(timer);
  }, [live, notify, setOrders]);

  const summary = useMemo(() => (mode === "ordenes" ? ordenesSummary(orders) : null), [orders, mode]);

  const confirm = (order: Order) => {
    // Cocina confirma la recepción: pendiente → en cocina.
    if (order.status !== "pendiente" || !canConfirm) return;
    setOrders(orders.map((o) => (o.id === order.id ? { ...o, status: "cocina" as const } : o)));
    setPendingConfirm(null);
    notify("Pedido en cocina", `${order.id} · ${order.customer}`);
  };

  const advance = (order: Order) => {
    // En cocina se marca listo (el entregado lo hace el mesero).
    if (order.status !== "cocina" || !canListo) return;
    const next: OrderStatus = "listo";
    setOrders(orders.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
    setPendingListo(null);
    notify("Orden lista", `${order.id} · ${order.customer}${order.waiter ? ` · avisar a ${order.waiter}` : ""}`);
  };

  const pendingCount = orders.filter((o) => o.status === "pendiente").length;
  const cookingCount = orders.filter((o) => o.status === "cocina").length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-section font-medium text-ink-900 flex items-center gap-2">
            {mode === "cocina" ? "Cocina" : "Órdenes"}
          </h2>
          {mode === "cocina" ? (
            <p className="text-sm text-ink-400 mt-1">
              {pendingCount} por confirmar · {cookingCount} en cocina
            </p>
          ) : (
            <p className="text-sm text-ink-400 mt-1">
              Comandas de <strong className="text-ink-900">{activeBranch.name}</strong>.
            </p>
          )}
        </div>
        {mode === "ordenes" && (
          <Button
            variant="secondary"
            onClick={() => setLive(!live)}
            className="border-ink-900/20 hover:border-ink-900 w-full sm:w-max min-h-12"
          >
            {live ? "Pausar en vivo" : "Reanudar en vivo"}
          </Button>
        )}
      </div>

      {mode === "ordenes" && summary && (
        <ModuleSummary
          kpis={summary.kpis}
          chartTitle="Comandas por estado"
          chartSubtitle="Resumen en vivo de la operación"
          ariaLabel="Resumen de órdenes"
        >
          <MiniBars data={summary.bars} label="Comandas por estado: por confirmar, cocina, listo y entregado" />
        </ModuleSummary>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {columns.map((col) => {
          const items = orders.filter((o) => o.status === col.id);
          return (
            <div key={col.id} className="bg-primary/[0.03] rounded-2xl p-3">
              <div className="flex items-center justify-between px-1 mb-3">
                <h3 className="text-nav font-medium text-ink-600">{col.label}</h3>
                <span className="text-xs font-medium text-ink-400 bg-surface rounded-full px-2 py-0.5 border border-ink-900/10">
                  {items.length}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {items.length === 0 && (
                  <p className="text-xs text-ink-400 text-center py-6">Sin comandas aquí.</p>
                )}
                {items.map((o) => (
                  <Card
                    key={o.id}
                    as="article"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-ink-900">{o.id}</span>
                      {mode === "ordenes" && (
                        <span className="flex items-center gap-1.5">
                          {isGeneral && branchOf("orders", o.id) && (
                            <Badge tone="neutral">{branchOf("orders", o.id)?.short}</Badge>
                          )}
                          <Badge tone="neutral">{o.channel}</Badge>
                        </span>
                      )}
                    </div>
                    <p className="text-nav text-ink-600 mb-2">
                      {mode === "cocina" ? o.customer : `${o.customer} · ${o.time}`}
                    </p>
                    <ul className="text-sm text-ink-900 mb-2">
                      {o.items.map((it, i) => (
                        <li key={i}>
                          <span className="font-medium">{it.qty}×</span> {it.name}
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-center gap-2 pt-3 border-t border-ink-900/[0.06]">
                      <span className="text-sm font-medium text-ink-900 tnum flex-1">{o.total}</span>
                      {o.status === "pendiente" && canConfirm && (
                        <Button
                          onClick={() => setPendingConfirm(o)}
                          className="px-5 min-h-12 w-full min-[420px]:w-auto text-sm"
                        >
                          Confirmar recepción
                        </Button>
                      )}
                      {o.status === "cocina" && canListo && (
                        <Button
                          onClick={() => setPendingListo(o)}
                          className="px-5 min-h-12 w-full min-[420px]:w-auto text-sm"
                        >
                          Marcar listo
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <ConfirmDialog
        open={pendingConfirm !== null}
        title="Confirmar recepción"
        message={
          pendingConfirm
            ? `¿Confirmar la recepción de ${pendingConfirm.id}? Pasará a En cocina.`
            : ""
        }
        confirmLabel="Confirmar"
        onConfirm={() => pendingConfirm && confirm(pendingConfirm)}
        onCancel={() => setPendingConfirm(null)}
      />
      <ConfirmDialog
        open={pendingListo !== null}
        title="Marcar listo"
        message={
          pendingListo
            ? `¿Marcar ${pendingListo.id} como listo? Se avisará al mesero.`
            : ""
        }
        confirmLabel="Marcar listo"
        onConfirm={() => pendingListo && advance(pendingListo)}
        onCancel={() => setPendingListo(null)}
      />
    </div>
  );
}
