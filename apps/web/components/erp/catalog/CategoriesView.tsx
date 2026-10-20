"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/fields";
import { Toolbar } from "@/components/ui/Toolbar";
import { TableCard, THead, TH, TR, TD, RowActions } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";
import { cartaSummary } from "@/components/erp/summaries/summary-selectors";

/** Maestro de categorías de producto. */
export function CategoriesView() {
  const { categories, products, notify, saveCategory, deleteCategory, catalogLoading, catalogError } = useModules();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const sorted = [...categories].sort((a, b) => a.position - b.position);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const position = editingId
        ? categories.find((c) => c.id === editingId)?.position ?? 0
        : Math.max(0, ...categories.map((c) => c.position)) + 1;
      await saveCategory({ id: editingId ?? undefined, name: name.trim(), position });
      notify(editingId ? "Categoría actualizada" : "Categoría creada", `"${name}" guardada.`);
      setModalOpen(false);
      setName("");
      setEditingId(null);
    } catch (error) {
      notify("No se pudo guardar la categoría", error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (products.some((p) => p.categoryId === id)) {
      setPendingDelete(null);
      return;
    }
    try {
      await deleteCategory(id);
      notify("Categoría eliminada", "Se retiró del maestro.");
    } catch (error) {
      notify("No se pudo eliminar la categoría", error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setPendingDelete(null);
    }
  };

  const summary = useMemo(() => cartaSummary(products, categories, () => 0), [products, categories]);

  return (
    <div>
      {catalogError && (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {catalogError}
        </p>
      )}
      {catalogLoading && categories.length === 0 && (
        <p className="text-sm text-ink-400 mb-4">Cargando categorías…</p>
      )}
      <ModuleSummary
        kpis={summary.kpis.slice(0, 3).map((k, i) => (i === 1 ? { ...k, value: String(categories.length), hint: "en maestro" } : k))}
        chartTitle="Platos por categoría"
        chartSubtitle="Distribución del maestro"
        ariaLabel="Resumen de categorías"
      >
        <MiniBars data={summary.bars} label="Platos por categoría" />
      </ModuleSummary>
      <Toolbar
        left={<p className="text-sm text-ink-400">{categories.length} categorías en el maestro.</p>}
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
            const count = products.filter((p) => p.categoryId === c.id).length;
            return (
              <TR key={c.id}>
                <TD tone="muted" className="tnum">
                  <span className="text-nav">{c.position}</span>
                </TD>
                <TD tone="strong">{c.name}</TD>
                <TD className="tnum">{count}</TD>
                <TD right nowrap>
                  <RowActions
                    editLabel="Renombrar"
                    onEdit={() => {
                      setEditingId(c.id);
                      setName(c.name);
                      setModalOpen(true);
                    }}
                    onDelete={() => setPendingDelete({ id: c.id, name: c.name })}
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
