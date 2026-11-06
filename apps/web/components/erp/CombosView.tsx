"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/fields";
import { Modal } from "@/components/ui/Modal";
import { Toolbar } from "@/components/ui/Toolbar";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";
import { combosSummary } from "@/components/erp/summaries/summary-selectors";
import { HubBlocks } from "@/components/erp/workspace-ui";

/** Combos: paquetes de productos con precio fijo. */
export function CombosView() {
  const { combos, setCombos, products, notify } = useModules();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", productIds: [] as string[], price: "", status: "Activo" as "Activo" | "Inactivo" });

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: "", description: "", productIds: [], price: "", status: "Activo" });
    setModalOpen(true);
  };

  const openEdit = (id: number) => {
    const c = combos.find((x) => x.id === id);
    if (!c) return;
    setEditingId(id);
    setForm({ name: c.name, description: c.description, productIds: c.productIds, price: String(c.price), status: c.status });
    setModalOpen(true);
  };

  const toggleProduct = (id: string) => {
    setForm({
      ...form,
      productIds: form.productIds.includes(id)
        ? form.productIds.filter((p) => p !== id)
        : [...form.productIds, id],
    });
  };

  const save = () => {
    if (!form.name.trim() || form.productIds.length === 0) return;
    if (editingId) {
      setCombos(combos.map((c) => (c.id === editingId ? { ...c, name: form.name, description: form.description, productIds: form.productIds, price: Number(form.price) || 0, status: form.status } : c)));
      notify("Combo actualizado", `"${form.name}" guardado.`);
    } else {
      const id = Math.max(0, ...combos.map((c) => c.id)) + 1;
      setCombos([...combos, { id, name: form.name, description: form.description, productIds: form.productIds, price: Number(form.price) || 0, status: form.status }]);
      notify("Combo creado", `"${form.name}" ya está disponible.`);
    }
    setModalOpen(false);
  };

  const productName = (id: string) => {
    const p = products.find((x) => x.id === id);
    return p ? p.name : "Plato retirado";
  };

  const summary = useMemo(() => combosSummary(combos), [combos]);

  return (
    <div>
      <div id="combos-resumen" className="scroll-mt-4">
      <ModuleSummary
        kpis={summary.kpis}
        chartTitle="Precio por combo"
        chartSubtitle="Paquetes con precio fijo"
        ariaLabel="Resumen de combos"
      >
        <MiniBars data={summary.bars} label="Precio por combo activo" />
      </ModuleSummary>
      </div>
      <Toolbar
        left={<p className="text-sm text-ink-400">{combos.filter((c) => c.status === "Activo").length} combos activos.</p>}
        right={
          <Button onClick={openCreate}>
            + Nuevo combo
          </Button>
        }
      />

      <div id="combos-maestro" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 scroll-mt-4">
        {combos.map((c) => (
          <Card key={c.id} className="flex flex-col">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="text-sm font-medium text-ink-900">{c.name}</h3>
              <Badge tone={c.status === "Activo" ? "success" : "neutral"} dot>
                {c.status}
              </Badge>
            </div>
            <p className="text-nav text-ink-400 mb-3">{c.description}</p>
            <ul className="text-sm text-ink-600 mb-4 flex-1">
              {c.productIds.map((id) => (
                <li key={id}>· {productName(id)}</li>
              ))}
            </ul>
            <div className="flex items-center justify-between pt-3 border-t border-ink-900/[0.06]">
              <span className="text-sm font-medium text-ink-900 tnum">${c.price.toFixed(2)}</span>
              <button
                type="button"
                onClick={() => openEdit(c.id)}
                className="text-nav font-medium text-ink-900 hover:underline cursor-pointer"
              >
                Editar
              </button>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8">
      <HubBlocks
        acceso={[{ label: "Nuevo combo", onSelect: openCreate }]}
        informes={[
          { label: "Precio por combo", href: "#combos-resumen" },
          { label: "Maestro de combos", href: "#combos-maestro" },
        ]}
      />
      </div>

      {modalOpen && (
        <Modal
          onClose={() => setModalOpen(false)}
          title={editingId ? "Editar combo" : "Nuevo combo"}
          wide
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!form.name.trim() || form.productIds.length === 0}
                onClick={save}
              >
                Guardar combo
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Field label="Nombre">
                <TextInput
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej. Dúo Criollo"
                />
              </Field>
            </div>
            <div>
              <Field label="Precio fijo ($)">
                <TextInput
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0.00"
                  className="tnum"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Descripción">
                <TextInput
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ej. Para compartir"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <span className="block text-nav font-medium text-ink-600 mb-2">
                Platos incluidos ({form.productIds.length})
              </span>
              <div className="flex flex-wrap gap-2">
                {products.filter((p) => p.status === "Activo").map((p) => {
                  const on = form.productIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProduct(p.id)}
                      className={`px-4 h-10 rounded-full text-nav font-medium cursor-pointer ${
                        on ? "bg-primary text-white" : "text-ink-600 border border-ink-900/15"
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Field label="Estado">
                <span className="flex items-center gap-2 text-sm text-ink-600">
                  <input
                    type="checkbox"
                    checked={form.status === "Activo"}
                    onChange={(e) => setForm({ ...form, status: e.target.checked ? "Activo" : "Inactivo" })}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  Activo para la venta
                </span>
              </Field>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
