"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Select, TextInput } from "@/components/ui/fields";
import { Toolbar } from "@/components/ui/Toolbar";
import { useModules } from "@/components/dashboard/ModulesProvider";
import type { Order } from "@/lib/erp";

/** Panel del mesero: crea pedidos de SU sucursal y sigue SUS órdenes. */
export function MozoView() {
  const { currentUser, orders, setOrders, tables, products, priceOf, notify } = useModules();
  const [mesaId, setMesaId] = useState("");
  const [customer, setCustomer] = useState("");
  const [picked, setPicked] = useState<number[]>([]);

  const me = currentUser?.name ?? "Mesero";
  const mine = orders.filter((o) => o.waiter === me);
  const ready = mine.filter((o) => o.status === "listo").length;

  const toggleDish = (id: number) => {
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const total = picked.reduce((s, id) => s + priceOf(id), 0);

  const submit = () => {
    if (!mesaId || picked.length === 0) return;
    const table = tables.find((t) => String(t.id) === mesaId);
    const items = picked.map((id) => {
      const p = products.find((x) => x.id === id);
      return { name: p?.name ?? `#${id}`, qty: 1 };
    });
    const order: Order = {
      // eslint-disable-next-line react-hooks/purity -- id único generado en el handler, no en render
      id: `#PD-${Date.now().toString().slice(-4)}`,
      customer: customer.trim() || table?.label || "Salón",
      items,
      total: `$${total.toFixed(2)}`,
      time: new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
      elapsed: "ahora mismo",
      status: "cocina",
      channel: "QR mesa",
      waiter: me,
    };
    setOrders([order, ...orders]);
    notify("Pedido enviado a cocina", `${order.id} · ${order.customer} · ${order.total}`);
    setMesaId("");
    setCustomer("");
    setPicked([]);
  };

  return (
    <div>
      <Toolbar
        left={
          <p className="text-sm text-ink-400">
            {mine.length} órdenes mías · {ready > 0 ? `${ready} listas` : "sin listas"}
          </p>
        }
      />

      <Card className="mb-4">
        <h3 className="text-sm font-medium text-ink-900 mb-3">Nuevo pedido</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <Field label="Mesa">
              <Select value={mesaId} onChange={(e) => setMesaId(e.target.value)}>
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
              />
            </Field>
          </div>
        </div>
        <span className="block text-nav font-medium text-ink-600 mb-2">Platos</span>
        <div className="flex flex-wrap gap-2 mb-4">
          {products
            .filter((p) => p.status === "Activo")
            .map((p) => {
              const on = picked.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleDish(p.id)}
                  className={`px-4 h-10 rounded-full text-nav font-medium cursor-pointer ${
                    on ? "bg-primary text-white" : "text-ink-600 border border-ink-900/15"
                  }`}
                >
                  {p.name} · ${priceOf(p.id).toFixed(2)}
                </button>
              );
            })}
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-ink-900/[0.06]">
          <span className="text-sm font-medium text-ink-900 tnum">Total ${total.toFixed(2)}</span>
          <Button disabled={!mesaId || picked.length === 0} onClick={submit}>
            Enviar a cocina
          </Button>
        </div>
      </Card>

      <h3 className="text-sm font-medium text-ink-900 mb-3">Mis órdenes</h3>
      {mine.length === 0 ? (
        <p className="text-sm text-ink-400">Aún no tomaste órdenes en este turno.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mine.map((o) => (
            <Card key={o.id} as="article">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-ink-900">{o.id}</span>
                <Badge tone={o.status === "listo" ? "success" : o.status === "cocina" ? "warning" : "neutral"} dot>
                  {o.status === "cocina" ? "En cocina" : o.status === "listo" ? "Lista" : "Entregada"}
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
              {o.status === "listo" && (
                <p className="mt-3 text-sm font-medium text-emerald-700">
                  ¡Lista para entregar!
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
