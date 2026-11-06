"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/fields";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";
import { priceListsSummary } from "@/components/erp/summaries/summary-selectors";

/** Listas de precios: Carta / Delivery / Eventos con vigencia y precio por producto. */
export function PriceListsView() {
  const {
    priceLists,
    products,
    categoryNameOf,
    notify,
    catalogLoading,
    catalogError,
    createPriceList,
    activatePriceList,
    setPrice,
  } = useModules();
  const [selectedId, setSelectedId] = useState(
    priceLists.find((l) => l.active)?.id ?? priceLists[0]?.id ?? "",
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingActive, setPendingActive] = useState<{ id: string; name: string } | null>(null);
  // Borradores de precio: se confirman con Enter o al salir del campo (no por tecla).
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const selected = priceLists.find((l) => l.id === selectedId) ?? priceLists[0];
  const summary = useMemo(() => priceListsSummary(priceLists, products), [priceLists, products]);

  if (!selected) {
    return (
      <div>
        {catalogError && (
          <p className="text-sm text-red-600 mb-4" role="alert">
            {catalogError}
          </p>
        )}
        <p className="text-sm text-ink-400">
          {catalogLoading ? "Cargando listas de precios…" : "Aún no hay listas de precios."}
        </p>
      </div>
    );
  }

  const commitPrice = async (platoId: string, raw: string, productName: string) => {
    const clearDraft = () =>
      setDrafts((d) => {
        const next = { ...d };
        delete next[platoId];
        return next;
      });
    const value = raw.trim();
    // Vacío o inválido: revierte al precio guardado en vez de dejar 0.
    if (value === "" || Number.isNaN(Number(value))) {
      clearDraft();
      return;
    }
    const price = Number(value);
    clearDraft();
    try {
      await setPrice(selected.id, platoId, price);
      notify("Precio actualizado", `"${productName}" · $${price.toFixed(2)} en ${selected.name}.`);
    } catch (error) {
      notify("No se pudo guardar el precio", error instanceof Error ? error.message : "Error inesperado");
    }
  };

  const setActive = async (id: string) => {
    const name = priceLists.find((l) => l.id === id)?.name ?? "—";
    setPendingActive(null);
    try {
      await activatePriceList(id);
      notify(
        "Lista activa actualizada",
        `La Carta Virtual ahora muestra precios de "${name}".`,
      );
    } catch (error) {
      notify("No se pudo activar la lista", error instanceof Error ? error.message : "Error inesperado");
    }
  };

  const duplicateList = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createPriceList(newName.trim(), selected.id);
      notify("Lista creada", `"${newName}" parte de los precios de "${selected.name}".`);
      setNewName("");
      setModalOpen(false);
    } catch (error) {
      notify("No se pudo crear la lista", error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {catalogError && (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {catalogError}
        </p>
      )}
      <ModuleSummary
        kpis={summary.kpis}
        chartTitle="Precio promedio por lista"
        chartSubtitle="Carta vs Delivery vs Eventos"
        ariaLabel="Resumen de listas de precios"
      >
        <MiniBars data={summary.bars} label="Precio promedio por lista" />
      </ModuleSummary>
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
          <Button onClick={() => setPendingActive({ id: selected.id, name: selected.name })} className="w-max">
            Activar en carta
          </Button>
        )}
      </Card>

      <TableCard>
        <THead>
          <tr>
            <TH>SKU</TH>
            <TH>Plato</TH>
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
                    value={drafts[p.id] ?? (selected.prices[p.id] ?? "")}
                    onChange={(e) => setDrafts({ ...drafts, [p.id]: e.target.value })}
                    onBlur={(e) => commitPrice(p.id, e.target.value, p.name)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    aria-label={`Precio de ${p.name} en ${selected.name}`}
                    placeholder="—"
                    className="px-3 tnum"
                  />
                </div>
              </TD>
            </TR>
          ))}
        </tbody>
      </TableCard>

      <ConfirmDialog
        open={pendingActive !== null}
        title="Activar lista en carta"
        message={
          pendingActive
            ? `¿Activar la lista "${pendingActive.name}"? La Carta Virtual mostrará sus precios.`
            : ""
        }
        confirmLabel="Activar"
        onConfirm={() => pendingActive && setActive(pendingActive.id)}
        onCancel={() => setPendingActive(null)}
      />

      {modalOpen && (
        <Modal
          onClose={() => setModalOpen(false)}
          title="Nueva lista de precios"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button disabled={!newName.trim() || saving} onClick={duplicateList}>
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
