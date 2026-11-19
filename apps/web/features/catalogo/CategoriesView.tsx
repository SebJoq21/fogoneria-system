"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/fields";
import { Toolbar } from "@/components/ui/Toolbar";
import { TableCard, THead, TH, TR, TD, RowActions } from "@/components/ui/data-table";
import { ModuleSummary } from "@/components/dashboard/summaries/ModuleSummary";
import { MiniBars } from "@/components/dashboard/summaries/charts";
import { validarCategoria } from "@fogoneria/contracts/catalogo";
import { useCatalogo } from "./hooks";

/** Maestro de categorías de producto. */
export function CategoriesView() {
  const {
    categorias,
    platos,
    resumenCarta,
    notificar,
    guardarCategoria,
    borrarCategoria,
    cargando,
    error,
  } = useCatalogo();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const sorted = [...categorias].sort((a, b) => a.posicion - b.posicion);

  const save = async () => {
    if (validarCategoria({ nombre: name })) return;
    setSaving(true);
    try {
      const posicion = editingId
        ? categorias.find((c) => c.id === editingId)?.posicion ?? 0
        : Math.max(0, ...categorias.map((c) => c.posicion)) + 1;
      await guardarCategoria({ id: editingId ?? undefined, nombre: name.trim(), posicion });
      notificar(editingId ? "Categoría actualizada" : "Categoría creada", `"${name}" guardada.`);
      setModalOpen(false);
      setName("");
      setEditingId(null);
    } catch (error) {
      notificar("No se pudo guardar la categoría", error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (platos.some((p) => p.categoriaId === id)) {
      setPendingDelete(null);
      return;
    }
    try {
      await borrarCategoria(id);
      notificar("Categoría eliminada", "Se retiró del maestro.");
    } catch (error) {
      notificar("No se pudo eliminar la categoría", error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setPendingDelete(null);
    }
  };

  const summary = resumenCarta;

  return (
    <div>
      {error && (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {error}
        </p>
      )}
      {cargando && categorias.length === 0 && (
        <p className="text-sm text-ink-400 mb-4">Cargando categorías…</p>
      )}
      <ModuleSummary
        kpis={summary.kpis.slice(0, 3).map((k, i) => (i === 1 ? { ...k, value: String(categorias.length), hint: "en maestro" } : k))}
        chartTitle="Platos por categoría"
        chartSubtitle="Distribución del maestro"
        ariaLabel="Resumen de categorías"
      >
        <MiniBars data={summary.bars} label="Platos por categoría" />
      </ModuleSummary>
      <Toolbar
        left={<p className="text-sm text-ink-400">{categorias.length} categorías en el maestro.</p>}
        right={
          <Button
            onClick={() => {
              setEditingId(null);
              setName("");
              setModalOpen(true);
            }}
          >
            + Nueva categoría
          </Button>
        }
      />

      <TableCard>
        <THead>
          <tr>
            <TH>Orden</TH>
            <TH>Nombre</TH>
            <TH>Platos</TH>
            <TH right>Acciones</TH>
          </tr>
        </THead>
        <tbody>
          {sorted.map((c) => {
            const count = platos.filter((p) => p.categoriaId === c.id).length;
            return (
              <TR key={c.id}>
                <TD tone="muted" className="tnum">
                  <span className="text-nav">{c.posicion}</span>
                </TD>
                <TD tone="strong">{c.nombre}</TD>
                <TD className="tnum">{count}</TD>
                <TD right nowrap>
                  <RowActions
                    editLabel="Renombrar"
                    onEdit={() => {
                      setEditingId(c.id);
                      setName(c.nombre);
                      setModalOpen(true);
                    }}
                    onDelete={() => setPendingDelete({ id: c.id, name: c.nombre })}
                    deleteDisabled={count > 0}
                    deleteTitle={count > 0 ? "Tiene platos asociados" : "Eliminar"}
                  />
                </TD>
              </TR>
            );
          })}
        </tbody>
      </TableCard>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Eliminar categoría"
        message={
          pendingDelete
            ? `¿Eliminar la categoría "${pendingDelete.name}"? Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        danger
        onConfirm={() => pendingDelete && remove(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />

      {modalOpen && (
        <Modal
          onClose={() => setModalOpen(false)}
          title={editingId ? "Renombrar categoría" : "Nueva categoría"}
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button disabled={!name.trim() || saving} onClick={save}>
                Guardar
              </Button>
            </>
          }
        >
          <Field label="Nombre">
            <TextInput
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Postres"
            />
          </Field>
        </Modal>
      )}
    </div>
  );
}
