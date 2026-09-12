"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Select, TextInput } from "@/components/ui/fields";
import { useModules } from "@/components/dashboard/ModulesProvider";
import type { Order } from "@/lib/erp";
import { canAnularPendiente, canCreateOrder, canMarkEntregado } from "@/lib/permissions";

/** Panel del mesero: genera pedidos en una pestaña y ve estados en otra. Sin gráficas. */
export function MozoView() {
  const { currentUser, orders, setOrders, setCashMovements, setReceipts, receipts, cashMovements, tables, products, priceOf, notify } = useModules();
  const parseTotal = (v: string): number => Number(String(v).replace(/[$,\s]/g, "")) || 0;
  const [tab, setTab] = useState<"nuevo" | "estados">("nuevo");
  const [mesaId, setMesaId] = useState("");
  const [customer, setCustomer] = useState("");
  const [picked, setPicked] = useState<number[]>([]);

  const me = currentUser?.name ?? "Mesero";
  const canOrder = canCreateOrder(currentUser?.role);
  const canDeliver = canMarkEntregado(currentUser?.role);
  const mine = orders.filter((o) => o.waiter === me);

  const toggleDish = (id: number) => {
    if (!canOrder) return;
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const total = picked.reduce((s, id) => s + priceOf(id), 0);

  const nextReceiptNumber = () => {
    const nums = receipts.map((r) => Number(String(r.id).split("-")[1]) || 0);
    return `B001-${Math.max(1042, ...nums) + 1}`;
  };

  const anular = (order: Order) => {
    if (!canAnularPendiente(currentUser?.role, order, me)) return;
    setOrders(orders.filter((o) => o.id !== order.id));
    notify("Pedido anulado", `${order.id} · ${order.customer}`);
  };

  const markDelivered = (order: Order) => {
    if (!canDeliver || order.status !== "listo") return;
    const amount = parseTotal(order.total);
    setOrders(orders.map((o) => (o.id === order.id ? { ...o, status: "entregado" as const } : o)));
    if (!cashMovements.some((m) => m.concept.includes(order.id))) {
      const cashId = Date.now() + Math.floor(Math.random() * 1000);
      setCashMovements([
        { id: cashId, datetime: "Ahora mismo", concept: `Venta ${order.id} · ${order.customer}`, kind: "Ingreso", amount, method: "Efectivo" },
        ...cashMovements,
      ]);
    }
    if (!receipts.some((r) => r.source === order.id)) {
      const num = nextReceiptNumber();
      setReceipts([
        { id: num, date: "Ahora mismo", customer: order.customer, total: `$${amount.toFixed(2)}`, status: "Pagada", source: order.id },
        ...receipts,
      ]);
    }
    notify("Orden entregada", `${order.id} · ${order.customer} · caja y comprobante generados`);
  };

  const submit = () => {
    if (!canOrder || !mesaId || picked.length === 0) return;
    const table = tables.find((t) => String(t.id) === mesaId);
    const items = picked.map((id) => {
      const p = products.find((x) => x.id === id);
      return { productId: id, name: p?.name ?? `#${id}`, qty: 1 };
    });
    const order: Order = {
      // eslint-disable-next-line react-hooks/purity -- id único generado en el handler, no en render
      id: `#PD-${Date.now().toString().slice(-4)}`,
      customer: customer.trim() || table?.label || "Salón",
      items,
      total: `$${total.toFixed(2)}`,
      time: new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
      elapsed: "ahora mismo",
      status: "pendiente",
      channel: "Mesa",
      waiter: me,
    };
    setOrders([order, ...orders]);
    notify("Pedido enviado", `${order.id} · ${order.customer} · espera confirmación de cocina`);
    setMesaId("");
    setCustomer("");
    setPicked([]);
  };

  return (
    <div>
      <div className="flex gap-2 mb-4" role="tablist" aria-label="Panel del mesero">
        {(["nuevo", "estados"] as const).map((t) => (
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
            {t === "nuevo" ? "Generar pedido" : "Estados"}
          </button>
        ))}
      </div>

      {!canOrder && (
        <p className="text-xs text-ink-400 mb-4">Vista de lectura: solo el mesero registra y entrega pedidos.</p>
      )}
      {tab === "nuevo" ? (
      <Card className="mb-4">
        <h3 className="text-sm font-medium text-ink-900 mb-3">Nuevo pedido</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <Field label="Mesa">
              <Select value={mesaId} onChange={(e) => setMesaId(e.target.value)} disabled={!canOrder}>
                <option value="">Selecciona mesa…</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} · {t.zone}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div>
            <Field label="Cliente (opcional)">
              <TextInput
                type="text"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Ej. Mesa 4 / Juan"
                disabled={!canOrder}
              />
            </Field>
          </div>
        </div>
        <span className="block text-nav font-medium text-ink-600 mb-2">Platos</span>
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-2 mb-4">
          {products
            .filter((p) => p.status === "Activo")
            .map((p) => {
              const on = picked.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={!canOrder}
                  onClick={() => toggleDish(p.id)}
                  aria-pressed={on}
                  className={`px-4 min-h-12 rounded-2xl text-sm font-medium text-left transition-colors ${
                    on ? "bg-primary text-white" : "text-ink-900 border border-ink-900/15 hover:border-ink-900"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {p.name} · ${priceOf(p.id).toFixed(2)}
                </button>
              );
            })}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-3 border-t border-ink-900/[0.06] sticky bottom-0 bg-surface py-3">
          <span className="text-sm font-medium text-ink-900 tnum flex-1">Total ${total.toFixed(2)}</span>
          <Button disabled={!canOrder || !mesaId || picked.length === 0} onClick={submit} className="w-full sm:w-auto min-h-12">
            Enviar a cocina
          </Button>
        </div>
      </Card>
      ) : (
      <>
      {mine.length === 0 ? (
        <p className="text-sm text-ink-400">Aún no tomaste órdenes en este turno.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mine.map((o) => (
            <Card key={o.id} as="article">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-ink-900">{o.id}</span>
                <Badge tone={o.status === "listo" ? "success" : o.status === "pendiente" ? "neutral" : o.status === "cocina" ? "warning" : "neutral"} dot>
                  {o.status === "pendiente" ? "Por confirmar" : o.status === "cocina" ? "En cocina" : o.status === "listo" ? "Lista" : "Entregada"}
                </Badge>
              </div>
              <p className="text-nav text-ink-600 mb-2">
                {o.customer} · {o.time}
              </p>
              <ul className="text-sm text-ink-900">
                {o.items.map((it, i) => (
                  <li key={i}>
                    <span className="font-medium">{it.qty}×</span> {it.name}
                  </li>
                ))}
              </ul>
              {o.status === "pendiente" && canAnularPendiente(currentUser?.role, o, me) && (
                <button
                  type="button"
                  onClick={() => anular(o)}
                  className="mt-3 text-nav font-medium text-ink-400 hover:text-ink-900 cursor-pointer min-h-12 w-full text-left"
                >
                  Anular pedido
                </button>
              )}
              {o.status === "listo" && canDeliver && (
                <Button onClick={() => markDelivered(o)} className="mt-3 w-full min-h-12 text-sm">
                  Marcar entregado
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );
}
