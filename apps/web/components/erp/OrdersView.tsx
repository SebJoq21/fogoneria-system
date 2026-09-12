"use client";

import { useEffect, useRef, useState } from "react";
import { type Order, type OrderStatus } from "@/lib/erp";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useModules } from "@/components/dashboard/ModulesProvider";

const columns: { id: OrderStatus; label: string }[] = [
  { id: "cocina", label: "En cocina" },
  { id: "listo", label: "Listo" },
  { id: "entregado", label: "Entregado" },
];

const demoIncoming: Omit<Order, "id" | "time" | "elapsed" | "status">[] = [
  { customer: "Mesa 5", items: [{ name: "Lomo Saltado", qty: 1 }], total: "$22.00", channel: "QR mesa" },
  { customer: "Lucía Prado", items: [{ name: "Causa Limeña", qty: 2 }], total: "$24.00", channel: "Web" },
];

export function OrdersView() {
  const { notify, orders, setOrders, activeBranch, isGeneral, branchOf } = useModules();
  const [live, setLive] = useState(true);
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
          { ...tpl, id: `#PD-${next}`, time, elapsed: "ahora mismo", status: "cocina" },
          ...prev,
        ]);
        notify("Nueva comanda entrante", `${tpl.customer} · ${tpl.total}`);
    }, 45000);
    return () => clearInterval(timer);
  }, [live, notify, setOrders]);

  const advance = (order: Order) => {
    const next: OrderStatus | null =
      order.status === "cocina" ? "listo" : order.status === "listo" ? "entregado" : null;
    if (!next) return;
    setOrders(orders.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
    if (next === "listo") {
      notify("Orden lista", `${order.id} · ${order.customer}${order.waiter ? ` · avisar a ${order.waiter}` : ""}`);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-section font-medium text-ink-900 flex items-center gap-2">
            Órdenes
            {live && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                En vivo
              </span>
            )}
          </h2>
          <p className="text-sm text-ink-400 mt-1">
            Comandas de <strong className="text-ink-900">{activeBranch.name}</strong>.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setLive(!live)}
          className="border-ink-900/20 hover:border-ink-900 w-max"
        >
          {live ? "Pausar en vivo" : "Reanudar en vivo"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
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
                      <span className="flex items-center gap-1.5">
                        {isGeneral && branchOf("orders", o.id) && (
                          <Badge tone="neutral">{branchOf("orders", o.id)?.short}</Badge>
                        )}
                        <Badge tone="neutral">{o.channel}</Badge>
                      </span>
                    </div>
                    <p className="text-nav text-ink-600 mb-2">
                      {o.customer} · {o.time} ({o.elapsed})
                    </p>
                    <ul className="text-sm text-ink-900 mb-2">
                      {o.items.map((it, i) => (
                        <li key={i}>
                          <span className="font-medium">{it.qty}×</span> {it.name}
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between pt-3 border-t border-ink-900/[0.06]">
                      <span className="text-sm font-medium text-ink-900">{o.total}</span>
                      {o.status !== "entregado" && (
                        <Button
                          onClick={() => advance(o)}
                          className="px-4 text-nav"
                        >
                          {o.status === "cocina" ? "Marcar listo" : "Marcar entregado"}
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
    </div>
  );
}
