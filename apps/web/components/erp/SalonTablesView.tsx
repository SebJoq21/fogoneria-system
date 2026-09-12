"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/fields";
import { Toolbar } from "@/components/ui/Toolbar";
import { TableCard, THead, TH, TR, TD, RowActions } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";
import type { TableShape } from "@/lib/erp";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";
import { mesasSummary } from "@/components/erp/summaries/summary-selectors";

const zones = ["Salón", "Terraza", "Barra"];

/** Maestro de Mesas: estructura del salón que consume el mapa. */
export function SalonTablesView() {
  const { tables, setTables, notify, isGeneral, branchOf } = useModules();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ label: "", zone: zones[0], seats: "4", shape: "rect" as TableShape });
  const summary = useMemo(() => mesasSummary(tables), [tables]);
  const byZone = useMemo(() => {
    const acc: Record<string, number> = {};
    tables.forEach((t) => {
      acc[t.zone] = (acc[t.zone] ?? 0) + 1;
    });
    return Object.entries(acc).map(([name, v]) => ({ name: name.slice(0, 10), v }));
  }, [tables]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ label: `Mesa ${Math.max(0, ...tables.map((t) => t.id)) + 1}`, zone: zones[0], seats: "4", shape: "rect" });
    setModalOpen(true);
  };

  const openEdit = (id: number) => {
    const t = tables.find((x) => x.id === id);
    if (!t) return;
    setEditingId(id);
    setForm({ label: t.label, zone: t.zone, seats: String(t.seats), shape: t.shape });
    setModalOpen(true);
  };

  const save = () => {
    if (!form.label.trim()) return;
    if (editingId) {
      setTables(
        tables.map((t) =>
          t.id === editingId
            ? { ...t, label: form.label, zone: form.zone, seats: Number(form.seats) || t.seats, shape: form.shape }
            : t,
        ),
      );
      notify("Mesa actualizada", `"${form.label}" guardada en el maestro.`);
    } else {
      const id = Math.max(0, ...tables.map((t) => t.id)) + 1;
      setTables([
        ...tables,
        { id, label: form.label, zone: form.zone, seats: Number(form.seats) || 2, shape: form.shape, status: "libre" },
      ]);
      notify("Mesa creada", `"${form.label}" añadida al salón.`);
    }
    setModalOpen(false);
  };

  const remove = (id: number) => {
    setTables(tables.filter((t) => t.id !== id));
  };

  return (
    <div>
      <ModuleSummary
        kpis={summary.kpis}
        chartTitle="Mesas por zona"
        chartSubtitle="Estructura del salón maestro"
        ariaLabel="Resumen maestro de mesas"
      >
        <MiniBars data={byZone} label="Mesas por zona del salón" />
      </ModuleSummary>
      <Toolbar
        left={
          <p className="text-sm text-ink-400">
            {tables.length} mesas · {zones.length} zonas. El mapa refleja estos cambios al instante.
          </p>
        }
        right={
          <Button onClick={openCreate}>
            + Nueva mesa
          </Button>
        }
      />

      <TableCard>
        <THead>
          <tr>
            <TH>Mesa</TH>
            {isGeneral && <TH>Sucursal</TH>}
            <TH>Zona</TH>
            <TH>Asientos</TH>
            <TH>Forma</TH>
            <TH>Estado en mapa</TH>
            <TH right>Acciones</TH>
          </tr>
        </THead>
        <tbody>
          {tables.map((t) => (
            <TR key={t.id}>
              <TD tone="strong">{t.label}</TD>
              {isGeneral && <TD tone="muted">{branchOf("tables", t.id)?.short}</TD>}
              <TD>{t.zone}</TD>
              <TD className="tnum">{t.seats}</TD>
              <TD>{t.shape === "round" ? "Circular" : "Rectangular"}</TD>
              <TD>
                <Badge
                  tone={t.status === "libre" ? "success" : t.status === "ocupada" ? "danger" : "warning"}
                  dot
                >
                  {t.status === "libre" ? "Libre" : t.status === "ocupada" ? "En servicio" : "Reservada"}
                </Badge>
              </TD>
              <TD right nowrap>
                <RowActions onEdit={() => openEdit(t.id)} onDelete={() => remove(t.id)} />
              </TD>
            </TR>
          ))}
        </tbody>
      </TableCard>

      {modalOpen && (
        <Modal
          onClose={() => setModalOpen(false)}
          title={editingId ? "Editar mesa" : "Nueva mesa"}
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button disabled={!form.label.trim()} onClick={save}>
                Guardar
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Field label="Nombre">
                <TextInput type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </Field>
            </div>
            <div>
              <Field label="Zona">
                <Select value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })}>
                  {zones.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div>
              <Field label="Asientos">
                <TextInput type="number" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} className="tnum" />
              </Field>
            </div>
            <div>
              <Field label="Forma">
                <Select value={form.shape} onChange={(e) => setForm({ ...form, shape: e.target.value as TableShape })}>
                  <option value="round">Circular</option>
                  <option value="rect">Rectangular</option>
                </Select>
              </Field>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
