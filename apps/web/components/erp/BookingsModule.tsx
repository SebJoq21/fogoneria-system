"use client";

import { useMemo, useState } from "react";
import {
  type Reservation,
  type ReservationStatus,
  type Table,
  type TableStatus,
} from "@/lib/erp";
import { Badge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Select, Textarea, TextInput } from "@/components/ui/fields";
import { Modal } from "@/components/ui/Modal";
import { Toolbar } from "@/components/ui/Toolbar";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniDonut } from "@/components/erp/summaries/charts";
import { mesasSummary } from "@/components/erp/summaries/summary-selectors";
import { useNow } from "@/components/useNow";
import {
  accountTotals,
  deriveTableStatus,
  fmtMoney,
  newId,
} from "@/lib/domain";
import {
  canChangeTableStatus,
  canManageReservations,
  canOpenAccount,
} from "@/lib/permissions";

const statusTone: Record<TableStatus, "success" | "danger" | "warning"> = {
  libre: "success",
  ocupada: "danger",
  reservada: "warning",
};

const statusLabel: Record<TableStatus, string> = {
  libre: "Libre",
  ocupada: "En servicio",
  reservada: "Reservada",
};

const resTone: Record<ReservationStatus, "success" | "warning" | "danger" | "neutral"> = {
  confirmada: "success",
  llego: "warning",
  no_show: "danger",
  cancelada: "neutral",
};

const resLabel: Record<ReservationStatus, string> = {
  confirmada: "Confirmada",
  llego: "Llegó",
  no_show: "No-show",
  cancelada: "Cancelada",
};

function TableNode({ table, onSelect }: { table: Table; onSelect: () => void }) {
  const color =
    table.status === "libre"
      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
      : table.status === "ocupada"
        ? "bg-red-50 border-red-300 text-red-700"
        : "bg-amber-50 border-amber-300 text-amber-700";
  const shape = table.shape === "round" ? "rounded-full w-20 h-20" : "rounded-2xl w-28 h-20";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`border-2 ${shape} ${color} flex flex-col items-center justify-center gap-0.5 transition-transform hover:scale-105 cursor-pointer shrink-0`}
    >
      <span className="text-nav font-medium leading-none">{table.label}</span>
      <span className="text-xs opacity-70">{table.seats} pers.</span>
    </button>
  );
}

type ResForm = {
  id: string | null;
  customer: string;
  phone: string;
  day: string;
  hour: string;
  guests: string;
  tableId: string;
  notes: string;
};

const todayKey = () => new Date().toISOString().slice(0, 10);

function emptyForm(): ResForm {
  return {
    id: null,
    customer: "",
    phone: "",
    day: todayKey(),
    hour: "20:00",
    guests: "2",
    tableId: "",
    notes: "",
  };
}

/** Mapa del salón (estados reales) + agenda de reservas con CRUD. */
export function BookingsModule({ view = "mapa" }: { view?: "agenda" | "mapa" }) {
  const {
    tables,
    setTables,
    reservations,
    setReservations,
    accounts,
    openAccount,
    currentUser,
    notify,
  } = useModules();
  useNow(30000);
  const role = currentUser?.role;
  const canBook = canManageReservations(role);
  const canOpen = canOpenAccount(role);
  const canOperate = canChangeTableStatus(role);

  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [confirmTable, setConfirmTable] = useState<Table | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ResForm>(emptyForm);
  const [pendingCancel, setPendingCancel] = useState<Reservation | null>(null);
  const [pendingNoShow, setPendingNoShow] = useState<Reservation | null>(null);
  const [dayFilter, setDayFilter] = useState(todayKey);

  const derivedTables = useMemo(
    () => tables.map((t) => ({ ...t, status: deriveTableStatus(t, accounts, reservations) })),
    [tables, accounts, reservations],
  );
  const summary = useMemo(() => mesasSummary(derivedTables), [derivedTables]);

  const dayRes = useMemo(
    () =>
      reservations
        .filter((r) => r.date.slice(0, 10) === dayFilter)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [reservations, dayFilter],
  );

  const tableLabel = (id: number | null) =>
    id === null
      ? "Por asignar"
      : (tables.find((t) => t.id === id)?.label ?? `Mesa ${id}`);

  const openAccountFor = (table: Table, customer: string) => {
    const id = openAccount({
      tableId: table.id,
      label: table.label,
      customer,
      waiter: currentUser?.name ?? "Salón",
    });
    if (id) notify("Cuenta abierta", `${table.label} · ${customer || "consumidor final"}`);
    return id;
  };

  const markLlego = (r: Reservation) => {
    const table = tables.find((t) => t.id === r.tableId);
    if (table) openAccountFor(table, r.customer);
    setReservations(reservations.map((x) => (x.id === r.id ? { ...x, status: "llego" as const } : x)));
    setSelectedTable(null);
  };

  const openCreate = (tableId?: number) => {
    setForm({ ...emptyForm(), tableId: tableId ? String(tableId) : "" });
    setFormOpen(true);
  };

  const openEdit = (r: Reservation) => {
    setForm({
      id: r.id,
      customer: r.customer,
      phone: r.phone,
      day: r.date.slice(0, 10),
      hour: r.time,
      guests: String(r.guests),
      tableId: r.tableId === null ? "" : String(r.tableId),
      notes: r.notes,
    });
    setFormOpen(true);
  };

  const saveRes = () => {
    if (!form.customer.trim()) return;
    const dateIso = new Date(`${form.day}T${form.hour}:00`).toISOString();
    const tableId = form.tableId ? Number(form.tableId) : null;
    if (form.id) {
      setReservations(
        reservations.map((r) =>
          r.id === form.id
            ? {
                ...r,
                customer: form.customer.trim(),
                phone: form.phone.trim(),
                date: dateIso,
                time: form.hour,
                guests: Number(form.guests) || r.guests,
                tableId,
                notes: form.notes.trim(),
              }
            : r,
        ),
      );
      notify("Reserva actualizada", `${form.customer} · ${form.hour}`);
    } else {
      const res: Reservation = {
        id: newId("RS"),
        customer: form.customer.trim(),
        guests: Number(form.guests) || 2,
        phone: form.phone.trim(),
        date: dateIso,
        time: form.hour,
        status: "confirmada",
        notes: form.notes.trim(),
        tableId,
      };
      setReservations([res, ...reservations]);
      notify("Reserva creada", `${res.customer} · ${res.time} · ${res.guests} comensales`);
    }
    setFormOpen(false);
  };

  const setStatus = (r: Reservation, status: ReservationStatus, title: string) => {
    setReservations(reservations.map((x) => (x.id === r.id ? { ...x, status } : x)));
    notify(title, `${r.customer} · ${r.time}`);
    setPendingCancel(null);
    setPendingNoShow(null);
    setSelectedTable(null);
  };

  const toggleBloqueo = (table: Table) => {
    const next: TableStatus = table.status === "reservada" ? "libre" : "reservada";
    setTables(tables.map((t) => (t.id === table.id ? { ...t, status: next } : t)));
    notify(next === "reservada" ? "Mesa bloqueada" : "Mesa desbloqueada", table.label);
    setConfirmTable(null);
    setSelectedTable(null);
  };

  return (
    <div>
      <ModuleSummary
        kpis={view === "mapa" ? summary.kpis : summary.kpis.slice(0, 3)}
        chartTitle={view === "mapa" ? "Ocupación del salón" : "Mesas por estado"}
        chartSubtitle="Estados reales: cuenta abierta y reservas de hoy"
        ariaLabel="Resumen de mesas"
      >
        <MiniDonut data={summary.donut} label="Distribución de mesas por estado" />
      </ModuleSummary>

      {view === "agenda" && (
        <>
          <Toolbar
            left={
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-medium text-ink-900">Reservas del día</h3>
                <TextInput
                  type="date"
                  value={dayFilter}
                  onChange={(e) => setDayFilter(e.target.value)}
                  className="w-40"
                  aria-label="Filtrar por fecha"
                />
                <span className="text-xs text-ink-400">{dayRes.length} reserva(s)</span>
              </div>
            }
            right={
              canBook ? (
                <Button onClick={() => openCreate()}>+ Nueva reserva</Button>
              ) : undefined
            }
          />
          {dayRes.length === 0 ? (
            <Card>
              <p className="text-sm text-ink-400">
                Sin reservas para esta fecha. Crea una para bloquear la mesa en el mapa.
              </p>
            </Card>
          ) : (
            <TableCard>
              <THead>
                <tr>
                  <TH>Hora</TH>
                  <TH>Cliente</TH>
                  <TH>Teléfono</TH>
                  <TH>Mesa</TH>
                  <TH>Comensales</TH>
                  <TH>Estado</TH>
                  <TH right>Acciones</TH>
                </tr>
              </THead>
              <tbody>
                {dayRes.map((r) => (
                  <TR key={r.id}>
                    <TD tone="strong" nowrap className="tnum">
                      {r.time}
                    </TD>
                    <TD tone="strong">
                      {r.customer}
                      {r.notes && <span className="block text-xs text-ink-400">{r.notes}</span>}
                    </TD>
                    <TD tone="muted" nowrap>
                      {r.phone || "—"}
                    </TD>
                    <TD>{tableLabel(r.tableId)}</TD>
                    <TD className="tnum">{r.guests}</TD>
                    <TD>
                      <Badge tone={resTone[r.status]} dot>
                        {resLabel[r.status]}
                      </Badge>
                    </TD>
                    <TD right nowrap>
                      <span className="flex items-center gap-3 justify-end">
                        {r.status === "confirmada" && canOpen && (
                          <button
                            type="button"
                            onClick={() => markLlego(r)}
                            className="text-ink-400 hover:text-ink-900 font-medium text-nav cursor-pointer"
                          >
                            Llegó
                          </button>
                        )}
                        {(r.status === "confirmada" || r.status === "llego") && canBook && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(r)}
                              className="text-ink-400 hover:text-ink-900 font-medium text-nav cursor-pointer"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingNoShow(r)}
                              className="text-ink-400 hover:text-ink-900 font-medium text-nav cursor-pointer"
                            >
                              No-show
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingCancel(r)}
                              className="text-ink-400 hover:text-persimmon-600 font-medium text-nav cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                        {(r.status === "cancelada" || r.status === "no_show") && (
                          <span className="text-nav text-ink-400">—</span>
                        )}
                      </span>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </TableCard>
          )}
        </>
      )}

      {view === "mapa" && (
        <div>
          <Card>
            <div className="flex flex-wrap gap-4 justify-center">
              {derivedTables.map((t) => (
                <TableNode key={t.id} table={t} onSelect={() => setSelectedTable(t)} />
              ))}
            </div>
          </Card>
          <div className="flex flex-wrap gap-4 mt-4">
            <span className="flex items-center gap-1.5 text-xs text-ink-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Libre
            </span>
            <span className="flex items-center gap-1.5 text-xs text-ink-600">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Ocupada con cuenta abierta
            </span>
            <span className="flex items-center gap-1.5 text-xs text-ink-600">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Reservada (hoy) o bloqueada
            </span>
          </div>
        </div>
      )}

      <Drawer
        open={selectedTable !== null}
        onClose={() => setSelectedTable(null)}
        title={selectedTable ? `Detalle · ${selectedTable.label}` : ""}
      >
        {selectedTable &&
          (() => {
            const table =
              derivedTables.find((t) => t.id === selectedTable.id) ?? selectedTable;
            const account = accounts.find(
              (a) => a.tableId === table.id && a.status === "abierta",
            );
            const res = reservations.find(
              (r) => r.tableId === table.id && r.status === "confirmada",
            );
            const totals = account ? accountTotals(account) : null;
            return (
              <div className="flex flex-col gap-4">
                <Badge tone={statusTone[table.status]} dot>
                  {statusLabel[table.status]}
                </Badge>

                {account && totals && (
                  <div className="rounded-2xl border border-ink-900/10 p-3">
                    <p className="text-sm font-medium text-ink-900">
                      Cuenta abierta · {fmtMoney(totals.total)}
                    </p>
                    <p className="text-xs text-ink-400 mt-0.5">
                      {account.customer || "Consumidor final"} · mesero {account.waiter} ·{" "}
                      {account.items.length} plato(s). El cobro se realiza en Caja.
                    </p>
                  </div>
                )}

                {res ? (
                  <dl className="flex flex-col gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-ink-400 mb-0.5">Reserva</dt>
                      <dd className="font-medium text-ink-900">
                        {res.customer} · {res.time} · {res.guests} pers.
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-400 mb-0.5">Teléfono</dt>
                      <dd className="text-ink-900">{res.phone || "—"}</dd>
                    </div>
                    {res.notes && (
                      <div>
                        <dt className="text-xs text-ink-400 mb-0.5">Notas</dt>
                        <dd className="text-ink-600">{res.notes}</dd>
                      </div>
                    )}
                  </dl>
                ) : (
                  <p className="text-sm text-ink-400">Sin reserva asociada a esta mesa.</p>
                )}

                <div className="flex flex-col gap-2">
                  {table.status === "libre" && canOpen && (
                    <Button onClick={() => openAccountFor(table, "")}>
                      Abrir cuenta
                    </Button>
                  )}
                  {res && canOpen && (
                    <Button variant="secondary" onClick={() => markLlego(res)}>
                      Registrar llegada y abrir cuenta
                    </Button>
                  )}
                  {canBook && (
                    <Button variant="secondary" href="/app/modulos/reservas/agenda">
                      Gestionar reservas
                    </Button>
                  )}
                  {canOperate && table.status !== "ocupada" && (
                    <Button variant="secondary" onClick={() => setConfirmTable(table)}>
                      {table.status === "reservada" ? "Desbloquear mesa" : "Bloquear mesa"}
                    </Button>
                  )}
                  {!canOpen && !canBook && !canOperate && (
                    <p className="text-xs text-ink-400">Vista de lectura.</p>
                  )}
                </div>
              </div>
            );
          })()}
      </Drawer>

      <ConfirmDialog
        open={confirmTable !== null}
        title={confirmTable?.status === "reservada" ? "Desbloquear mesa" : "Bloquear mesa"}
        message={
          confirmTable
            ? confirmTable.status === "reservada"
              ? `¿Desbloquear "${confirmTable.label}"? Volverá a estar disponible.`
              : `¿Bloquear "${confirmTable.label}"? No aceptará comensales hasta desbloquearla.`
            : ""
        }
        confirmLabel={confirmTable?.status === "reservada" ? "Desbloquear" : "Bloquear"}
        danger={confirmTable?.status !== "reservada"}
        onConfirm={() => confirmTable && toggleBloqueo(confirmTable)}
        onCancel={() => setConfirmTable(null)}
      />

      <ConfirmDialog
        open={pendingCancel !== null}
        title="Cancelar reserva"
        message={
          pendingCancel
            ? `¿Cancelar la reserva de ${pendingCancel.customer} (${pendingCancel.time})?`
            : ""
        }
        confirmLabel="Cancelar reserva"
        danger
        onConfirm={() =>
          pendingCancel && setStatus(pendingCancel, "cancelada", "Reserva cancelada")
        }
        onCancel={() => setPendingCancel(null)}
      />

      <ConfirmDialog
        open={pendingNoShow !== null}
        title="Marcar no-show"
        message={
          pendingNoShow
            ? `¿Registrar que ${pendingNoShow.customer} no se presentó?`
            : ""
        }
        confirmLabel="Marcar no-show"
        danger
        onConfirm={() =>
          pendingNoShow && setStatus(pendingNoShow, "no_show", "Reserva marcada no-show")
        }
        onCancel={() => setPendingNoShow(null)}
      />

      {formOpen && (
        <Modal
          onClose={() => setFormOpen(false)}
          title={form.id ? "Editar reserva" : "Nueva reserva"}
          footer={
            <>
              <Button variant="ghost" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button disabled={!form.customer.trim()} onClick={saveRes}>
                {form.id ? "Guardar cambios" : "Crear reserva"}
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Field label="Cliente">
                <TextInput
                  type="text"
                  value={form.customer}
                  onChange={(e) => setForm({ ...form, customer: e.target.value })}
                  placeholder="Ej. Camila Duarte"
                />
              </Field>
            </div>
            <div>
              <Field label="Teléfono">
                <TextInput
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+51 999 999 999"
                />
              </Field>
            </div>
            <div>
              <Field label="Fecha">
                <TextInput
                  type="date"
                  value={form.day}
                  onChange={(e) => setForm({ ...form, day: e.target.value })}
                />
              </Field>
            </div>
            <div>
              <Field label="Hora">
                <TextInput
                  type="time"
                  value={form.hour}
                  onChange={(e) => setForm({ ...form, hour: e.target.value })}
                  className="tnum"
                />
              </Field>
            </div>
            <div>
              <Field label="Comensales">
                <TextInput
                  type="number"
                  min="1"
                  value={form.guests}
                  onChange={(e) => setForm({ ...form, guests: e.target.value })}
                  className="tnum"
                />
              </Field>
            </div>
            <div>
              <Field label="Mesa" hint="Se bloquea automáticamente en el mapa.">
                <Select
                  value={form.tableId}
                  onChange={(e) => setForm({ ...form, tableId: e.target.value })}
                >
                  <option value="">Por asignar</option>
                  {derivedTables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} · {t.seats} pers. · {statusLabel[t.status]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Notas">
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Ej. Cerca a la ventana, silla de bebé"
                  rows={2}
                />
              </Field>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
