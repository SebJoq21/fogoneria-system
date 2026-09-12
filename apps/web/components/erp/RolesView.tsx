"use client";

import { useMemo, useState } from "react";
import { initialEmployees } from "@/lib/erp";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, TextInput, Textarea } from "@/components/ui/fields";
import { Toolbar } from "@/components/ui/Toolbar";
import { TableCard, THead, TH, TR, TD, RowActions } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";

/** Maestro de Roles: define los roles operativos del equipo. */
export function RolesView() {
  const { roles, setRoles, notify } = useModules();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: "", description: "" });
    setModalOpen(true);
  };

  const openEdit = (id: string) => {
    const r = roles.find((x) => x.id === id);
    if (!r) return;
    setEditingId(id);
    setForm({ name: r.name, description: r.description });
    setModalOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) return;
    if (editingId) {
      setRoles(roles.map((r) => (r.id === editingId ? { ...r, description: form.description } : r)));
      notify("Rol actualizado", `"${form.name}" guardado.`);
    } else {
      const id = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      setRoles([...roles, { id, name: form.name, description: form.description }]);
      notify("Rol creado", `"${form.name}" añadido al maestro.`);
    }
    setModalOpen(false);
  };

  const remove = (id: string) => {
    const role = roles.find((r) => r.id === id);
    if (role && initialEmployees.some((e) => e.role === role.name)) return;
    setRoles(roles.filter((r) => r.id !== id));
  };

  const summary = useMemo(() => {
    const on = initialEmployees.filter((e) => e.onShift).length;
    return {
      kpis: [
        { label: "Roles", value: String(roles.length), hint: "operativos" },
        { label: "Equipo", value: String(initialEmployees.length), hint: "personas" },
        { label: "En turno", value: String(on), hint: "ahora mismo" },
        { label: "Cobertura", value: roles.length === 0 ? "—" : `${Math.round((initialEmployees.length / roles.length) * 10) / 10}x`, hint: "personas por rol" },
      ],
      bars: roles.slice(0, 6).map((r) => ({
        name: r.name.slice(0, 10),
        v: initialEmployees.filter((e) => e.role === r.name).length,
      })),
    };
  }, [roles]);

  return (
    <div>
      <ModuleSummary
        kpis={summary.kpis}
        chartTitle="Equipo por rol"
        chartSubtitle="Cobertura operativa de tu franquicia"
        ariaLabel="Resumen de roles"
      >
        <MiniBars data={summary.bars} label="Personas por rol" />
      </ModuleSummary>
      <Toolbar
        left={<p className="text-sm text-ink-400">{roles.length} roles operativos.</p>}
        right={
          <Button onClick={openCreate}>
            + Nuevo rol
          </Button>
        }
      />

      <TableCard>
        <THead>
          <tr>
            <TH>Rol</TH>
            <TH>Descripción</TH>
            <TH>Equipo</TH>
            <TH right>Acciones</TH>
          </tr>
        </THead>
        <tbody>
          {roles.map((r) => {
            const count = initialEmployees.filter((e) => e.role === r.name).length;
            return (
              <TR key={r.id}>
                <TD tone="strong">{r.name}</TD>
                <TD>{r.description}</TD>
                <TD className="tnum">
                  {count} persona{count === 1 ? "" : "s"}
                </TD>
                <TD right nowrap>
                  <RowActions
                    onEdit={() => openEdit(r.id)}
                    onDelete={() => remove(r.id)}
                    deleteDisabled={count > 0}
                    deleteTitle={count > 0 ? "Tiene equipo asignado" : "Eliminar"}
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
          title={editingId ? "Editar rol" : "Nuevo rol"}
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button disabled={!form.name.trim()} onClick={save}>
                Guardar
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Field label="Nombre">
              <TextInput
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={!!editingId}
                placeholder="Ej. Anfitrión"
                className="disabled:opacity-50"
              />
            </Field>
            <Field label="Descripción">
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
