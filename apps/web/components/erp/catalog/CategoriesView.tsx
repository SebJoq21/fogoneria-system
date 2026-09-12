"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
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
  const { categories, setCategories, products, notify } = useModules();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const sorted = [...categories].sort((a, b) => a.position - b.position);

  const save = () => {
    if (!name.trim()) return;
    if (editingId) {
      setCategories(categories.map((c) => (c.id === editingId ? { ...c, name } : c)));
      notify("Categoría actualizada", `"${name}" guardada.`);
    } else {
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      setCategories([
        ...categories,
        { id, name, position: Math.max(0, ...categories.map((c) => c.position)) + 1 },
      ]);
      notify("Categoría creada", `"${name}" añadida al maestro.`);
    }
    setModalOpen(false);
    setName("");
    setEditingId(null);
  };

  const remove = (id: string) => {
    if (products.some((p) => p.categoryId === id)) return;
    setCategories(categories.filter((c) => c.id !== id));
  };

  const summary = useMemo(() => cartaSummary(products, categories, () => 0), [products, categories]);

  return (
    <div>
      <ModuleSummary
        kpis={summary.kpis.slice(0, 3).map((k, i) => (i === 2 ? { ...k, label: "Categorías", value: String(categories.length), hint: "en maestro" } : k))}
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
                    onDelete={() => remove(c.id)}
                    deleteDisabled={count > 0}
                    deleteTitle={count > 0 ? "Tiene platos asociados" : "Eliminar"}
                  />
                </TD>
              </TR>
            );
          })}
        </tbody>
      </TableCard>

      {modalOpen && (
        <Modal
          onClose={() => setModalOpen(false)}
          title={editingId ? "Renombrar categoría" : "Nueva categoría"}
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button disabled={!name.trim()} onClick={save}>
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
