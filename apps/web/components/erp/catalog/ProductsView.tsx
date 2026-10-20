"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput, Textarea } from "@/components/ui/fields";
import { Toolbar } from "@/components/ui/Toolbar";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";
import { cartaSummary } from "@/components/erp/summaries/summary-selectors";

type Form = {
  id: string | null;
  name: string;
  description: string;
  categoryId: string;
  image: string;
  status: "Activo" | "Inactivo";
  modifierGroupIds: string[];
  price: string;
};

const emptyForm = (categoryId: string): Form => ({
  id: null,
  name: "",
  description: "",
  categoryId,
  image: "",
  status: "Activo",
  modifierGroupIds: [],
  price: "",
});

/** Maestro de productos: SKU, datos, categoría, modificadores y precio (lista activa). */
export function ProductsView({
  startCreating = false,
  createSignal = 0,
}: {
  startCreating?: boolean;
  /** Al cambiar, abre el modal de alta sin navegar (hub "Nuevo producto"). */
  createSignal?: number;
}) {
  const {
    products,
    categories,
    modifierGroups,
    priceLists,
    priceOf,
    categoryNameOf,
    notify,
    catalogLoading,
    catalogError,
    saveProduct,
    setProductActive,
  } = useModules();
  const [modalOpen, setModalOpen] = useState(startCreating);
  const [saving, setSaving] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{ id: string; name: string; toActive: boolean } | null>(null);
  const [form, setForm] = useState<Form>(emptyForm(categories[0]?.id ?? ""));
  const handledSignal = useRef(0);

  useEffect(() => {
    if (createSignal > handledSignal.current) {
      handledSignal.current = createSignal;
      setForm(emptyForm(categories[0]?.id ?? ""));
      setModalOpen(true);
    }
  }, [createSignal, categories]);

  const openCreate = () => {
    setForm(emptyForm(categories[0]?.id ?? ""));
    setModalOpen(true);
  };

  const openEdit = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setForm({
      id: p.id,
      name: p.name,
      description: p.description,
      categoryId: p.categoryId,
      image: p.image,
      status: p.status,
      modifierGroupIds: p.modifierGroupIds,
      price: String(priceOf(p.id)),
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.categoryId) return;
    setSaving(true);
    try {
      await saveProduct({
        id: form.id ?? undefined,
        name: form.name.trim(),
        description: form.description,
        categoryId: form.categoryId,
        image: form.image,
        status: form.status,
        modifierGroupIds: form.modifierGroupIds,
        price: Number(form.price) || 0,
      });
      notify(
        form.id ? "Plato actualizado" : "Plato creado",
        `"${form.name}" guardado en el maestro.`,
      );
      setModalOpen(false);
    } catch (error) {
      notify("No se pudo guardar el plato", error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (id: string, toActive: boolean) => {
    setPendingToggle(null);
    try {
      await setProductActive(id, toActive);
    } catch (error) {
      notify("No se pudo actualizar el plato", error instanceof Error ? error.message : "Error inesperado");
    }
  };

  const summary = useMemo(() => cartaSummary(products, categories, priceOf), [products, categories, priceOf]);

  return (
    <div>
      {catalogError && (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {catalogError}
        </p>
      )}
      {catalogLoading && products.length === 0 && (
        <p className="text-sm text-ink-400 mb-4">Cargando catálogo…</p>
      )}
      <ModuleSummary
        kpis={summary.kpis}
        chartTitle="Maestro por categoría"
        chartSubtitle="Cómo está compuesto tu catálogo"
        ariaLabel="Resumen de platos"
      >
        <MiniBars data={summary.bars} label="Platos por categoría" />
      </ModuleSummary>
      <Toolbar
        left={
          <p className="text-sm text-ink-400">
            {products.filter((p) => p.status === "Activo").length} activos · precio de lista{" "}
            <strong className="text-ink-900">
              {priceLists.find((l) => l.active)?.name}
            </strong>
          </p>
        }
        right={
          <Button onClick={openCreate}>
            + Nuevo plato
          </Button>
        }
      />

      <TableCard>
        <THead>
          <tr>
            <TH>SKU</TH>
            <TH>Plato</TH>
            <TH>Categoría</TH>
            <TH>Precio</TH>
            <TH>Modificadores</TH>
            <TH>Estado</TH>
            <TH right>Acciones</TH>
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
                <span className="bg-primary/[0.05] px-2.5 py-1 rounded-md text-xs font-medium text-ink-600">
                  {categoryNameOf(p.categoryId)}
                </span>
              </TD>
              <TD tone="strong" nowrap className="tnum">
                ${priceOf(p.id).toFixed(2)}
              </TD>
              <TD>
                <span className="text-nav">
                  {p.modifierGroupIds.length === 0
                    ? "—"
                    : p.modifierGroupIds
                        .map((g) => modifierGroups.find((m) => m.id === g)?.name)
                        .filter(Boolean)
                        .join(", ")}
                </span>
              </TD>
              <TD>
                <Badge tone={p.status === "Activo" ? "success" : "neutral"} dot>
                  {p.status}
                </Badge>
              </TD>
              <TD right nowrap>
                <button
                  type="button"
                  onClick={() => openEdit(p.id)}
                  className="text-ink-900 hover:underline font-medium text-nav mr-3 cursor-pointer"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const toActive = p.status !== "Activo";
                    setPendingToggle({ id: p.id, name: p.name, toActive });
                  }}
                  className="text-ink-400 hover:text-ink-900 font-medium text-nav cursor-pointer"
                >
                  {p.status === "Activo" ? "Desactivar" : "Activar"}
                </button>
              </TD>
            </TR>
          ))}
        </tbody>
      </TableCard>

      <ConfirmDialog
        open={pendingToggle !== null}
        title={pendingToggle?.toActive ? "Activar plato" : "Desactivar plato"}
        message={
          pendingToggle
            ? pendingToggle.toActive
              ? `¿Activar "${pendingToggle.name}"? Volverá a aparecer en la carta.`
              : `¿Desactivar "${pendingToggle.name}"? Dejará de aparecer en la carta.`
            : ""
        }
        confirmLabel={pendingToggle?.toActive ? "Activar" : "Desactivar"}
        onConfirm={() => pendingToggle && toggleStatus(pendingToggle.id, pendingToggle.toActive)}
        onCancel={() => setPendingToggle(null)}
      />

      {modalOpen && (
        <Modal
          onClose={() => setModalOpen(false)}
          title={form.id ? "Editar plato" : "Nuevo plato"}
          wide
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!form.name.trim() || !form.categoryId || saving}
                onClick={save}
              >
                Guardar plato
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Nombre">
                <TextInput
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej. Lomo Saltado"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Descripción">
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                />
              </Field>
            </div>
            <div>
              <Field label="Categoría">
                <Select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div>
              <Field label={`Precio (lista ${priceLists.find((l) => l.active)?.name})`}>
                <TextInput
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0.00"
                  className="tnum"
                />
              </Field>
            </div>
            <div>
              <Field label="URL de imagen">
                <TextInput
                  type="text"
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  placeholder="https://…"
                />
              </Field>
            </div>
            {form.id && (
              <div>
                <Field label="Estado">
                  <Select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as "Activo" | "Inactivo" })
                    }
                  >
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                  </Select>
                </Field>
              </div>
            )}
            <div className="sm:col-span-2">
              <span className="block text-nav font-medium text-ink-600 mb-2">
                Grupos de modificadores
              </span>
              <div className="flex flex-wrap gap-2">
                {modifierGroups.map((g) => {
                  const on = form.modifierGroupIds.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          modifierGroupIds: on
                            ? form.modifierGroupIds.filter((x) => x !== g.id)
                            : [...form.modifierGroupIds, g.id],
                        })
                      }
                      className={`px-4 h-10 rounded-full text-nav font-medium cursor-pointer ${
                        on
                          ? "bg-primary text-white"
                          : "text-ink-600 border border-ink-900/15"
                      }`}
                    >
                      {g.name}
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
