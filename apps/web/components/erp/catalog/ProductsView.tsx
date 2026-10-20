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
  id: number | null;
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
    setProducts,
    categories,
    modifierGroups,
    priceLists,
    setPriceLists,
    priceOf,
    categoryNameOf,
    notify,
  } = useModules();
  const [modalOpen, setModalOpen] = useState(startCreating);
  const [pendingToggle, setPendingToggle] = useState<{ id: number; name: string; toActive: boolean } | null>(null);
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

  const openEdit = (id: number) => {
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

  const save = () => {
    if (!form.name.trim() || !form.categoryId) return;
    const price = Number(form.price) || 0;
    let productId = form.id;

    if (form.id) {
      setProducts(
        products.map((p) =>
          p.id === form.id
            ? {
                ...p,
                name: form.name,
                description: form.description,
                categoryId: form.categoryId,
                image: form.image,
                status: form.status,
                modifierGroupIds: form.modifierGroupIds,
              }
            : p,
        ),
      );
    } else {
      productId = Math.max(0, ...products.map((p) => p.id)) + 1;
      setProducts([
        {
          id: productId,
          sku: `PLA-${String(productId).padStart(3, "0")}`,
          name: form.name,
          description: form.description,
          categoryId: form.categoryId,
          image:
            form.image ||
            "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
          modifierGroupIds: form.modifierGroupIds,
          // El alta siempre entra en Activo: si se añade, hay stock.
          status: "Activo",
        },
        ...products,
      ]);
    }

    // El precio vive en la lista activa, no en el producto
    setPriceLists(
      priceLists.map((l) =>
        l.active ? { ...l, prices: { ...l.prices, [productId as number]: price } } : l,
      ),
    );
    notify(
      form.id ? "Plato actualizado" : "Plato creado",
      `"${form.name}" guardado en el maestro.`,
    );
    setModalOpen(false);
  };

  const toggleStatus = (id: number) => {
    setProducts(
      products.map((p) =>
        p.id === id ? { ...p, status: p.status === "Activo" ? "Inactivo" : "Activo" } : p,
      ),
    );
    setPendingToggle(null);
  };

  const summary = useMemo(() => cartaSummary(products, categories, priceOf), [products, categories, priceOf]);

  return (
    <div>
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
        onConfirm={() => pendingToggle && toggleStatus(pendingToggle.id)}
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
                disabled={!form.name.trim() || !form.categoryId}
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
