"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/fields";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";

/** Listas de precios: Carta / Delivery / Eventos con vigencia y precio por producto. */
export function PriceListsView() {
  const { priceLists, setPriceLists, products, categoryNameOf, notify } = useModules();
  const [selectedId, setSelectedId] = useState(
    priceLists.find((l) => l.active)?.id ?? priceLists[0]?.id ?? "",
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const selected = priceLists.find((l) => l.id === selectedId) ?? priceLists[0];
  if (!selected) return null;

  const setPrice = (productId: number, value: string) => {
    const price = Number(value);
    if (Number.isNaN(price)) return;
    setPriceLists(
      priceLists.map((l) =>
        l.id === selected.id ? { ...l, prices: { ...l.prices, [productId]: price } } : l,
      ),
    );
  };

  const setActive = (id: string) => {
    setPriceLists(priceLists.map((l) => ({ ...l, active: l.id === id })));
    notify(
      "Lista activa actualizada",
      `La Carta Virtual ahora muestra precios de "${priceLists.find((l) => l.id === id)?.name}".`,
    );
  };

  const duplicateList = () => {
    if (!newName.trim()) return;
    const id = newName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    setPriceLists([
      ...priceLists,
      { id, name: newName, active: false, validFrom: "", validTo: "", prices: { ...selected.prices } },
    ]);
    setSelectedId(id);
    setNewName("");
    setModalOpen(false);
    notify("Lista creada", `"${newName}" parte de los precios de "${selected.name}".`);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {priceLists.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setSelectedId(l.id)}
            className={`px-4 h-10 rounded-full text-nav font-medium cursor-pointer inline-flex items-center gap-2 ${
              selected.id === l.id
                ? "bg-primary text-white"
                : "text-ink-600 border border-ink-900/15"
            }`}
          >
            {l.name}
            {l.active && (
              <span className="w-1.5 h-1.5 rounded-full bg-surface" aria-label="Lista activa" />
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-4 h-10 rounded-full text-nav font-medium text-ink-600 border border-dashed border-ink-900/20 hover:border-ink-900 cursor-pointer"
        >
          + Nueva lista
        </button>
      </div>

      <Card className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-ink-900">
            Lista {selected.name} {selected.active && <Badge tone="dark">Activa en carta</Badge>}
          </h3>
          <p className="text-nav text-ink-400 mt-0.5">
            Vigencia: {selected.validFrom || "—"} → {selected.validTo || "—"}
          </p>
        </div>
        {!selected.active && (
          <Button onClick={() => setActive(selected.id)} className="w-max">
            Activar en carta
          </Button>
        )}
      </Card>

      <TableCard>
        <THead>
          <tr>
            <TH>SKU</TH>
            <TH>Producto</TH>
            <TH>Categoría</TH>
            <TH>Precio ({selected.name})</TH>
          </tr>
        </THead>
        <tbody>
          {products.map((p) => (
            <TR key={p.id}>
              <TD tone="muted" nowrap>
                <span className="text-nav">{p.sku}</span>
              </TD>
              <TD tone="strong">{p.name}</TD>
              <TD>
                <span className="text-nav">{categoryNameOf(p.categoryId)}</span>
              </TD>
              <TD>
                <div className="flex items-center gap-1 max-w-36">
                  <span className="text-sm text-ink-400">$</span>
                  <TextInput
                    type="number"
                    value={selected.prices[p.id] ?? ""}
                    onChange={(e) => setPrice(p.id, e.target.value)}
                    aria-label={`Precio de ${p.name} en ${selected.name}`}
                    className="px-3 tnum"
                  />
                </div>
              </TD>
            </TR>
          ))}
        </tbody>
      </TableCard>

      {modalOpen && (
        <Modal
          onClose={() => setModalOpen(false)}
          title="Nueva lista de precios"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button disabled={!newName.trim()} onClick={duplicateList}>
                Crear lista
              </Button>
            </>
          }
        >
          <Field label="Nombre">
            <TextInput
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ej. Fin de semana"
            />
          </Field>
          <p className="text-xs text-ink-400 mt-2">
            La nueva lista copia los precios de “{selected.name}”.
          </p>
        </Modal>
      )}
    </div>
  );
}
