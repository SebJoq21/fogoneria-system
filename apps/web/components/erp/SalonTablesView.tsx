"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/fields";
import { Toolbar } from "@/components/ui/Toolbar";
import { TableCard, THead, TH, TR, TD, RowActions } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";
import type { TableShape } from "@/lib/erp";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";
import { mesasSummary } from "@/components/erp/summaries/summary-selectors";
import { deriveTableStatus } from "@/lib/domain";
import {
  createTable as apiCreateTable,
  deleteTable as apiDeleteTable,
  updateTable as apiUpdateTable,
} from "@/lib/tables-api";
import { shapeToApi, tableNumberFromLabel } from "@/lib/table-mapping";
import { ApiError } from "@/lib/api";

const OTHER_ZONE = "__otra__";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError || error instanceof Error ? error.message : fallback;
}

/** Maestro de Mesas: estructura del salón que consume el mapa (API, AYCDS-26). */
export function SalonTablesView() {
  const {
    tables,
    setTables,
    accounts,
    reservations,
    notify,
    isGeneral,
    branches,
    branchOf,
    hasSession,
    refreshTables,
  } = useModules();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ label: "", zone: "", newZone: "", seats: "4", shape: "rect" as TableShape });

  const zones = useMemo(
    () => [...new Set(tables.map((t) => t.zone))],
    [tables],
  );
  const derivedTables = useMemo(
    () => tables.map((t) => ({ ...t, status: deriveTableStatus(t, accounts, reservations) })),
    [tables, accounts, reservations],
  );
  const summary = useMemo(() => mesasSummary(derivedTables), [derivedTables]);
  const byZone = useMemo(() => {
    const acc: Record<string, number> = {};
    tables.forEach((t) => {
      acc[t.zone] = (acc[t.zone] ?? 0) + 1;
    });
    return Object.entries(acc).map(([name, v]) => ({ name: name.slice(0, 10), v }));
  }, [tables]);

  const branchLabel = (table: (typeof tables)[number]) => {
    if (table.branchId) {
      return branches.find((branch) => branch.id === table.branchId)?.short ?? "—";
    }
    return branchOf("tables", table.id)?.short;
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({
      label: `Mesa ${tables.length + 1}`,
      zone: zones[0] ?? "",
      newZone: "",
      seats: "4",
      shape: "rect",
    });
    setModalOpen(true);
  };

  const openEdit = (id: number) => {
    const t = tables.find((x) => x.id === id);
    if (!t) return;
    setEditingId(id);
    setForm({ label: t.label, zone: zones.includes(t.zone) ? t.zone : OTHER_ZONE, newZone: zones.includes(t.zone) ? "" : t.zone, seats: String(t.seats), shape: t.shape });
    setModalOpen(true);
  };

  const save = () => {
    if (!form.label.trim()) return;
    const zone = form.zone === OTHER_ZONE ? form.newZone.trim() : form.zone.trim();
    if (!zone) return;
    const seats = Number(form.seats) || 4;

    if (hasSession) {
      const editing = editingId ? tables.find((t) => t.id === editingId) : null;
      if (editingId && !editing?.apiId) {
        notify("No se pudo guardar la mesa", "La mesa no tiene identificador de la API.");
        return;
      }
      setSaving(true);
      void (async () => {
        try {
          const payload = {
            numero: tableNumberFromLabel(form.label),
            capacidad: seats,
            zona: zone,
            forma: shapeToApi(form.shape),
          };
          if (editing?.apiId) await apiUpdateTable(editing.apiId, payload);
          else await apiCreateTable(payload);
          await refreshTables();
          notify(
            editingId ? "Mesa actualizada" : "Mesa creada",
            `"${form.label}" ${editingId ? "guardada en" : "añadida al"} maestro.`,
          );
          setModalOpen(false);
        } catch (error) {
          notify("No se pudo guardar la mesa", errorMessage(error, "Inténtalo de nuevo."));
        } finally {
          setSaving(false);
        }
      })();
      return;
    }

    if (editingId) {
      setTables(
        tables.map((t) =>
          t.id === editingId
            ? { ...t, label: form.label, zone, seats, shape: form.shape }
            : t,
        ),
      );
      notify("Mesa actualizada", `"${form.label}" guardada en el maestro.`);
    } else {
      const id = Math.max(0, ...tables.map((t) => t.id)) + 1;
      setTables([
        ...tables,
        { id, label: form.label, zone, seats, shape: form.shape, status: "libre" },
      ]);
      notify("Mesa creada", `"${form.label}" añadida al salón.`);
    }
    setModalOpen(false);
  };

  const remove = (id: number) => {
    const table = tables.find((t) => t.id === id);

    if (hasSession) {
      if (!table?.apiId) {
        notify("No se pudo eliminar la mesa", "La mesa no tiene identificador de la API.");
        setPendingDeleteId(null);
        return;
      }
      void (async () => {
        try {
          await apiDeleteTable(table.apiId!);
          await refreshTables();
          notify("Mesa eliminada", "La mesa se retiró del salón.");
        } catch (error) {
          notify("No se pudo eliminar la mesa", errorMessage(error, "Inténtalo de nuevo."));
        } finally {
          setPendingDeleteId(null);
        }
      })();
      return;
    }

    setTables(tables.filter((t) => t.id !== id));
    setPendingDeleteId(null);
    notify("Mesa eliminada", "La mesa se retiró del salón.");
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
            {hasSession ? " Datos de la API." : ""}
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
          {derivedTables.map((t) => (
            <TR key={t.id}>
              <TD tone="strong">{t.label}</TD>
              {isGeneral && <TD tone="muted">{branchLabel(t)}</TD>}
              <TD>{t.zone}</TD>
              <TD className="tnum">{t.seats}</TD>
              <TD>{t.shape === "round" ? "Circular" : "Rectangular"}</TD>
              <TD>
                <Badge
                  tone={
                    t.blocked
                      ? "neutral"
                      : t.status === "libre"
                        ? "success"
                        : t.status === "ocupada"
                          ? "danger"
                          : "warning"
                  }
                  dot
                >
                  {t.blocked
                    ? "Bloqueada"
                    : t.status === "libre"
                      ? "Libre"
                      : t.status === "ocupada"
                        ? "En servicio"
                        : "Reservada"}
                </Badge>
              </TD>
              <TD right nowrap>
                <RowActions onEdit={() => openEdit(t.id)} onDelete={() => setPendingDeleteId(t.id)} />
              </TD>
            </TR>
          ))}
        </tbody>
      </TableCard>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Eliminar mesa"
        message="¿Eliminar esta mesa del salón? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
        onConfirm={() => pendingDeleteId !== null && remove(pendingDeleteId)}
        onCancel={() => setPendingDeleteId(null)}
      />

      {modalOpen && (
        <Modal
          onClose={() => setModalOpen(false)}
          title={editingId ? "Editar mesa" : "Nueva mesa"}
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!form.label.trim() || (form.zone === OTHER_ZONE && !form.newZone.trim()) || saving}
                onClick={save}
              >
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Field label="Nombre" hint={hasSession ? "La API guarda el número (máx. 10)." : undefined}>
                <TextInput type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </Field>
            </div>
            <div>
              <Field label="Zona">
                <Select value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value, newZone: "" })}>
                  {zones.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                  <option value={OTHER_ZONE}>+ Nueva zona…</option>
                </Select>
              </Field>
            </div>
            {form.zone === OTHER_ZONE && (
              <div>
                <Field label="Nombre de la zona">
                  <TextInput
                    type="text"
                    value={form.newZone}
                    onChange={(e) => setForm({ ...form, newZone: e.target.value })}
                    placeholder="Ej. Mezzanine"
                  />
                </Field>
              </div>
            )}
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
