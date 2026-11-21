"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/fields";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { ModuleSummary } from "@/components/dashboard/summaries/ModuleSummary";
import { MiniBars } from "@/components/dashboard/summaries/charts";
import { validarPrecio } from "@fogoneria/contracts/pricing";
import { usePricing } from "./hooks";

/** Listas de precios: Carta / Delivery / Eventos con vigencia y precio por producto. */
export function PriceListsView() {
  const {
    listas,
    platos,
    resumenListas,
    nombreDeCategoria,
    notificar,
    cargando,
    error,
    crearLista,
    activarLista,
    fijarPrecio,
  } = usePricing();
  const [selectedId, setSelectedId] = useState(
    listas.find((l) => l.activa)?.id ?? listas[0]?.id ?? "",
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingActive, setPendingActive] = useState<{ id: string; name: string } | null>(null);
  // Borradores de precio: se confirman con Enter o al salir del campo (no por tecla).
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const selected = listas.find((l) => l.id === selectedId) ?? listas[0];
  const summary = resumenListas;

  if (!selected) {
    return (
      <div>
        {error && (
          <p className="text-sm text-red-600 mb-4" role="alert">
            {error}
          </p>
        )}
        <p className="text-sm text-ink-400">
          {cargando ? "Cargando listas de precios…" : "Aún no hay listas de precios."}
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
    if (validarPrecio(price)) return;
    try {
      await fijarPrecio({ listaId: selected.id, platoId, precio: price });
      notificar("Precio actualizado", `"${productName}" · $${price.toFixed(2)} en ${selected.nombre}.`);
    } catch (error) {
      notificar("No se pudo guardar el precio", error instanceof Error ? error.message : "Error inesperado");
    }
  };

  const setActive = async (id: string) => {
    const name = listas.find((l) => l.id === id)?.nombre ?? "—";
    setPendingActive(null);
    try {
      await activarLista(id);
      notificar(
        "Lista activa actualizada",
        `La Carta Virtual ahora muestra precios de "${name}".`,
      );
    } catch (error) {
      notificar("No se pudo activar la lista", error instanceof Error ? error.message : "Error inesperado");
    }
  };

  const duplicateList = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await crearLista(newName.trim(), selected.id);
      notificar("Lista creada", `"${newName}" parte de los precios de "${selected.nombre}".`);
      setNewName("");
      setModalOpen(false);
    } catch (error) {
      notificar("No se pudo crear la lista", error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {error && (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {error}
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
        {listas.map((l) => (
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
            {l.nombre}
            {l.activa && (
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
            Lista {selected.nombre} {selected.activa && <Badge tone="dark">Activa en carta</Badge>}
          </h3>
          <p className="text-nav text-ink-400 mt-0.5">
            Vigencia: {selected.vigenciaDesde || "—"} → {selected.vigenciaHasta || "—"}
          </p>
        </div>
        {!selected.activa && (
          <Button onClick={() => setPendingActive({ id: selected.id, name: selected.nombre })} className="w-max">
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
            <TH>Precio ({selected.nombre})</TH>
          </tr>
        </THead>
        <tbody>
          {platos.map((p) => (
            <TR key={p.id}>
              <TD tone="muted" nowrap>
                <span className="text-nav">{p.sku}</span>
              </TD>
              <TD tone="strong">{p.nombre}</TD>
              <TD>
                <span className="text-nav">{nombreDeCategoria(p.categoriaId)}</span>
              </TD>
              <TD>
                <div className="flex items-center gap-1 max-w-36">
                  <span className="text-sm text-ink-400">$</span>
                  <TextInput
                    type="number"
                    value={drafts[p.id] ?? (selected.precios[p.id] ?? "")}
                    onChange={(e) => setDrafts({ ...drafts, [p.id]: e.target.value })}
                    onBlur={(e) => commitPrice(p.id, e.target.value, p.nombre)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    aria-label={`Precio de ${p.nombre} en ${selected.nombre}`}
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
            La nueva lista copia los precios de “{selected.nombre}”.
          </p>
        </Modal>
      )}
    </div>
  );
}
