"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput, Textarea } from "@/components/ui/fields";
import { Toolbar } from "@/components/ui/Toolbar";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { ModuleSummary } from "@/components/dashboard/summaries/ModuleSummary";
import { MiniBars } from "@/components/dashboard/summaries/charts";
import { validarPlato, type PlatoInput } from "@fogoneria/contracts/catalogo";
import { useCatalogo } from "./hooks";

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
    platos,
    categorias,
    grupos,
    listaActiva,
    resumenCarta,
    notificar,
    cargando,
    error,
    precioDe,
    nombreDeCategoria,
    guardarPlato,
    activarPlato,
  } = useCatalogo();
  const [modalOpen, setModalOpen] = useState(startCreating);
  const [saving, setSaving] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{ id: string; name: string; toActive: boolean } | null>(null);
  const [form, setForm] = useState<Form>(emptyForm(categorias[0]?.id ?? ""));
  const handledSignal = useRef(0);

  useEffect(() => {
    if (createSignal > handledSignal.current) {
      handledSignal.current = createSignal;
      setForm(emptyForm(categorias[0]?.id ?? ""));
      setModalOpen(true);
    }
  }, [createSignal, categorias]);

  const openCreate = () => {
    setForm(emptyForm(categorias[0]?.id ?? ""));
    setModalOpen(true);
  };

  const openEdit = (id: string) => {
    const p = platos.find((x) => x.id === id);
    if (!p) return;
    setForm({
      id: p.id,
      name: p.nombre,
      description: p.descripcion,
      categoryId: p.categoriaId,
      image: p.imagen,
      status: p.estado,
      modifierGroupIds: p.grupoIds,
      price: String(precioDe(p.id)),
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (validarPlato({ nombre: form.name, categoriaId: form.categoryId })) return;
    setSaving(true);
    try {
      const input: PlatoInput = {
        id: form.id ?? undefined,
        nombre: form.name.trim(),
        descripcion: form.description,
        categoriaId: form.categoryId,
        imagen: form.image,
        activo: form.status === "Activo",
        grupoIds: form.modifierGroupIds,
        precio: Number(form.price) || 0,
      };
      await guardarPlato(input);
      notificar(
        form.id ? "Plato actualizado" : "Plato creado",
        `"${form.name}" guardado en el maestro.`,
      );
      setModalOpen(false);
    } catch (error) {
      notificar("No se pudo guardar el plato", error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (id: string, toActive: boolean) => {
    setPendingToggle(null);
    try {
      await activarPlato(id, toActive);
    } catch (error) {
      notificar("No se pudo actualizar el plato", error instanceof Error ? error.message : "Error inesperado");
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
      {cargando && platos.length === 0 && (
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
            {platos.filter((p) => p.estado === "Activo").length} activos · precio de lista{" "}
            <strong className="text-ink-900">{listaActiva?.nombre}</strong>
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
          {platos.map((p) => (
            <TR key={p.id}>
              <TD tone="muted" nowrap>
                <span className="text-nav">{p.sku}</span>
              </TD>
              <TD tone="strong">{p.nombre}</TD>
              <TD>
                <span className="bg-primary/[0.05] px-2.5 py-1 rounded-md text-xs font-medium text-ink-600">
                  {nombreDeCategoria(p.categoriaId)}
                </span>
              </TD>
              <TD tone="strong" nowrap className="tnum">
                ${precioDe(p.id).toFixed(2)}
              </TD>
              <TD>
                <span className="text-nav">
                  {p.grupoIds.length === 0
                    ? "—"
                    : p.grupoIds
                        .map((g) => grupos.find((m) => m.id === g)?.nombre)
                        .filter(Boolean)
                        .join(", ")}
                </span>
              </TD>
              <TD>
                <Badge tone={p.estado === "Activo" ? "success" : "neutral"} dot>
                  {p.estado}
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
                    const toActive = p.estado !== "Activo";
                    setPendingToggle({ id: p.id, name: p.nombre, toActive });
                  }}
                  className="text-ink-400 hover:text-ink-900 font-medium text-nav cursor-pointer"
                >
                  {p.estado === "Activo" ? "Desactivar" : "Activar"}
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
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div>
              <Field label={`Precio (lista ${listaActiva?.nombre})`}>
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
                {grupos.map((g) => {
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
                      {g.nombre}
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
