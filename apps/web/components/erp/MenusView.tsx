"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/fields";
import { Modal } from "@/components/ui/Modal";
import { Toolbar } from "@/components/ui/Toolbar";
import { Toggle } from "@/components/ui/Toggle";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";

/** Menús publicados: almuerzo, cena y fin de semana compuestos de productos. */
export function MenusView() {
  const { menus, setMenus, products, notify } = useModules();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", validity: "", productIds: [] as number[] });

  const toggleProduct = (id: number) => {
    setForm({
      ...form,
      productIds: form.productIds.includes(id)
        ? form.productIds.filter((p) => p !== id)
        : [...form.productIds, id],
    });
  };

  const save = () => {
    if (!form.name.trim() || form.productIds.length === 0) return;
    const id = Math.max(0, ...menus.map((m) => m.id)) + 1;
    setMenus([...menus, { id, name: form.name, validity: form.validity || "Siempre", productIds: form.productIds, published: true }]);
    notify("Menú publicado", `"${form.name}" visible en carta y sitio.`);
    setModalOpen(false);
    setForm({ name: "", validity: "", productIds: [] });
  };

  const productName = (id: number) => products.find((p) => p.id === id)?.name ?? `#${id}`;

  return (
    <div>
      <Toolbar
        left={<p className="text-sm text-ink-400">{menus.filter((m) => m.published).length} menús publicados.</p>}
        right={
          <Button onClick={() => setModalOpen(true)}>
            + Nuevo menú
          </Button>
        }
      />

      <TableCard>
        <THead>
          <tr>
            <TH>Menú</TH>
            <TH>Vigencia</TH>
            <TH>Platos</TH>
            <TH right>Publicado</TH>
          </tr>
        </THead>
        <tbody>
          {menus.map((m) => (
            <TR key={m.id}>
              <TD tone="strong">{m.name}</TD>
              <TD tone="muted" nowrap>
                <span className="text-nav">{m.validity}</span>
              </TD>
              <TD>
                <span className="text-nav">{m.productIds.map(productName).join(", ")}</span>
              </TD>
              <TD right>
                <Toggle
                  checked={m.published}
                  onChange={() =>
                    setMenus(menus.map((x) => (x.id === m.id ? { ...x, published: !x.published } : x)))
                  }
                  label={`Publicar ${m.name}`}
                />
              </TD>
            </TR>
          ))}
        </tbody>
      </TableCard>

      {!menus.some((m) => m.published) && (
        <div className="mt-4">
          <Badge tone="warning">Sin menús publicados: la carta muestra la lista activa</Badge>
        </div>
      )}

      {modalOpen && (
        <Modal
          onClose={() => setModalOpen(false)}
          title="Nuevo menú"
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
                Publicar menú
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
                  placeholder="Ej. Almuerzo"
                />
              </Field>
            </div>
            <div>
              <Field label="Vigencia">
                <TextInput
                  type="text"
                  value={form.validity}
                  onChange={(e) => setForm({ ...form, validity: e.target.value })}
                  placeholder="Ej. Lun–Vie · 12:00–15:00"
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
          </div>
        </Modal>
      )}
    </div>
  );
}
