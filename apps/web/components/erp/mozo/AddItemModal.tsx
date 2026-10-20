"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/fields";
import { useModules } from "@/components/dashboard/ModulesProvider";
import {
  fmtMoney,
  newId,
  round2,
  type AccountItem,
  type AccountItemModifier,
} from "@/lib/domain";

/** Alta de línea en la cuenta: plato, cantidad, modificadores con recargo y notas. */
export function AddItemModal({
  onAdd,
  onClose,
}: {
  onAdd: (item: AccountItem) => void;
  onClose: () => void;
}) {
  const { products, priceOf, modifierGroups } = useModules();
  const active = products.filter((p) => p.status === "Activo");
  const [productId, setProductId] = useState<string | null>(active[0]?.id ?? null);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  const product = active.find((p) => p.id === productId) ?? null;
  const groups = (product?.modifierGroupIds ?? [])
    .map((id) => modifierGroups.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => !!g);

  const unitPrice = product ? priceOf(product.id) : 0;
  const picked: AccountItemModifier[] = groups.flatMap((g) =>
    (selected[g.id] ?? []).map((optId) => {
      const opt = g.options.find((o) => o.id === optId);
      return { optionId: optId, name: opt?.name ?? optId, extra: opt?.extra ?? 0 };
    }),
  );
  const lineTotal = round2((unitPrice + picked.reduce((s, m) => s + m.extra, 0)) * qty);

  const missingRequired = groups.some(
    (g) => g.required && (selected[g.id] ?? []).length === 0,
  );
  const canAdd = !!product && unitPrice > 0 && qty > 0 && !missingRequired;

  const toggle = (groupId: string, optId: string, multi: boolean) => {
    setSelected((prev) => {
      const cur = prev[groupId] ?? [];
      if (multi) {
        return {
          ...prev,
          [groupId]: cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId],
        };
      }
      return { ...prev, [groupId]: [optId] };
    });
  };

  const submit = () => {
    if (!product || !canAdd) return;
    onAdd({
      id: newId("AI"),
      productId: product.id,
      name: product.name,
      qty,
      unitPrice,
      modifiers: picked,
      notes: notes.trim(),
      sent: false,
    });
    onClose();
  };

  return (
    <Modal
      onClose={onClose}
      title="Agregar plato a la cuenta"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!canAdd} onClick={submit}>
            Agregar · {fmtMoney(lineTotal)}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <span className="block text-nav font-medium text-ink-600 mb-2">Plato</span>
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
            {active.map((p) => {
              const on = p.id === productId;
              const price = priceOf(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setProductId(p.id);
                    setSelected({});
                  }}
                  aria-pressed={on}
                  className={`px-4 min-h-12 rounded-2xl text-sm font-medium text-left transition-colors ${
                    on
                      ? "bg-primary text-white"
                      : "text-ink-900 border border-ink-900/15 hover:border-ink-900"
                  }`}
                >
                  {p.name} · {price > 0 ? fmtMoney(price) : "sin precio"}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Field label="Cantidad">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                className="w-10 px-0"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Restar cantidad"
              >
                −
              </Button>
              <span className="w-12 text-center text-sm font-medium text-ink-900 tnum">
                {qty}
              </span>
              <Button
                variant="secondary"
                className="w-10 px-0"
                onClick={() => setQty((q) => q + 1)}
                aria-label="Sumar cantidad"
              >
                +
              </Button>
            </div>
          </Field>
        </div>
        <div>
          <Field label="Notas de cocina (opcional)">
            <TextInput
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Sin cebolla"
            />
          </Field>
        </div>

        {groups.map((g) => (
          <div key={g.id} className="sm:col-span-2">
            <span className="block text-nav font-medium text-ink-600 mb-2">
              {g.name}
              {g.required && <span className="text-persimmon-600"> · obligatorio</span>}
              {g.multi && <span className="text-ink-400"> · múltiple</span>}
            </span>
            <div className="flex flex-wrap gap-2">
              {g.options.map((o) => {
                const on = (selected[g.id] ?? []).includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle(g.id, o.id, g.multi)}
                    aria-pressed={on}
                    className={`px-4 min-h-10 rounded-full text-sm font-medium transition-colors ${
                      on
                        ? "bg-primary text-white"
                        : "text-ink-900 border border-ink-900/15 hover:border-ink-900"
                    }`}
                  >
                    {o.name}
                    {o.extra > 0 && ` +${fmtMoney(o.extra)}`}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
