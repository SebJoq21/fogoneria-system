"use client";

import { useEffect, useMemo, useState } from "react";
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
import { useOrdersRealtime } from "@/components/erp/useOrdersRealtime";
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
import { ApiError } from "@/lib/api";
import {
  createReservation as apiCreateReservation,
  updateReservation as apiUpdateReservation,
  updateReservationStatus as apiUpdateReservationStatus,
} from "@/lib/reservations-api";
import { updateTableStatus as apiUpdateTableStatus } from "@/lib/tables-api";
import {
  apiReservationStatusOf,
  limaDateKey,
  limaTodayKey,
  reservationDateIso,
} from "@/lib/table-mapping";

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

const resTone: Record<
  ReservationStatus,
  "success" | "warning" | "danger" | "neutral" | "dark"
> = {
  por_confirmar: "dark",
  confirmada: "success",
  llego: "warning",
  no_show: "danger",
  cancelada: "neutral",
};

const resLabel: Record<ReservationStatus, string> = {
  por_confirmar: "Por confirmar",
  confirmada: "Confirmada",
  llego: "Llegó",
  no_show: "No-show",
  cancelada: "Cancelada",
};

function TableNode({ table, onSelect }: { table: Table; onSelect: () => void }) {
  const color = table.blocked
    ? "bg-ink-900/[0.04] border-ink-900/20 text-ink-400"
    : table.status === "libre"
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

function emptyForm(day = limaTodayKey()): ResForm {
  return {
    id: null,
    customer: "",
    phone: "",
    day,
    hour: "20:00",
    guests: "2",
    tableId: "",
    notes: "",
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError || error instanceof Error ? error.message : fallback;
}

/** Mapa del salón (estados reales) + agenda de reservas conectada a la API. */
export function BookingsModule({ view = "mapa" }: { view?: "agenda" | "mapa" }) {
  const {
    tables,
    setTables,
    reservations,
    setReservations,
    accounts,
    openAccount,
    currentUser,
    hasSession,
    notify,
    refreshTables,
    refreshReservations,
    tablesLoading,
    tablesError,
    reservationsLoading,
    reservationsError,
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
  const [saving, setSaving] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<Reservation | null>(null);
  const [pendingNoShow, setPendingNoShow] = useState<Reservation | null>(null);
  const [dayFilter, setDayFilter] = useState(limaTodayKey);

  /* Mesas y mesas/reservas en vivo: cualquier cambio en el salón relee la API. */
  const { status: liveStatus } = useOrdersRealtime(hasSession, (kind) => {
    if (kind === "table" || kind === "order") void refreshTables();
  });

  /* La agenda pide a la API el día seleccionado (hora de Lima). */
  useEffect(() => {
    if (!hasSession) return;
    void refreshReservations(dayFilter);
  }, [hasSession, dayFilter, refreshReservations]);

  const derivedTables = useMemo(
    () => tables.map((t) => ({ ...t, status: deriveTableStatus(t, accounts, reservations) })),
    [tables, accounts, reservations],
  );
  const summary = useMemo(() => mesasSummary(derivedTables), [derivedTables]);

  /* En modo API el servidor ya filtró por día; en demo se filtra por ISO local. */
  const dayRes = useMemo(() => {
    const list = hasSession
      ? reservations
      : reservations.filter((r) => r.date.slice(0, 10) === dayFilter);
    return [...list].sort((a, b) => a.date.localeCompare(b.date));
  }, [reservations, dayFilter, hasSession]);

  const tableLabel = (id: number | null) =>
    id === null
      ? "Por asignar"
      : (tables.find((t) => t.id === id)?.label ?? `Mesa ${id}`);

  const liveLabel =
    !hasSession
      ? "Modo demo"
      : liveStatus === "connected"
        ? "En vivo"
        : liveStatus === "connecting"
          ? "Conectando…"
          : liveStatus === "reconnecting"
            ? "Reconectando…"
            : "Sin canal en vivo";

  const openAccountFor = (table: Table, customer: string) => {
    const id = openAccount({
      tableId: table.id,
      tableApiId: table.apiId ?? null,
      label: table.label,
      customer,
      waiter: currentUser?.name ?? "Salón",
    });
    if (id) notify("Cuenta abierta", `${table.label} · ${customer || "consumidor final"}`);
    return id;
  };

  const markLlego = (r: Reservation) => {
    const table = tables.find((t) => t.id === r.tableId);
    if (hasSession) {
      void (async () => {
        try {
          await apiUpdateReservationStatus(r.id, "EJECUTADA");
          if (table) openAccountFor(table, r.customer);
          await Promise.all([refreshReservations(dayFilter), refreshTables()]);
          notify("Reserva en curso", `${r.customer} · ${r.time}`);
        } catch (error) {
          notify("No se pudo registrar la llegada", errorMessage(error, "Inténtalo de nuevo."));
        } finally {
          setSelectedTable(null);
        }
      })();
      return;
    }
    if (table) openAccountFor(table, r.customer);
    setReservations(reservations.map((x) => (x.id === r.id ? { ...x, status: "llego" as const } : x)));
    setSelectedTable(null);
  };

  const openCreate = (tableId?: number) => {
    setForm({ ...emptyForm(dayFilter), tableId: tableId ? String(tableId) : "" });
    setFormOpen(true);
  };

  const openEdit = (r: Reservation) => {
    setForm({
      id: r.id,
      customer: r.customer,
      phone: r.phone,
      day: limaDateKey(r.date) || dayFilter,
      hour: r.time,
      guests: String(r.guests),
      tableId: r.tableId === null ? "" : String(r.tableId),
      notes: r.notes,
    });
    setFormOpen(true);
  };

  const saveRes = async () => {
    if (!form.customer.trim()) return;
    const guests = Number(form.guests) || 2;
    const dateIso = reservationDateIso(form.day, form.hour);

    if (hasSession) {
      const table = derivedTables.find((t) => String(t.id) === form.tableId);
      if (!table?.apiId) {
        notify("Elige una mesa", "La reserva debe estar asociada a una mesa del salón.");
        return;
      }
      setSaving(true);
      try {
        const payload = {
          mesaId: table.apiId,
          clienteNombre: form.customer.trim(),
          telefono: form.phone.trim() || undefined,
          nroComensales: guests,
          fechaHora: dateIso,
          notas: form.notes.trim() || undefined,
        };
        if (form.id) await apiUpdateReservation(form.id, payload);
        else await apiCreateReservation(payload);
        await Promise.all([refreshReservations(dayFilter), refreshTables()]);
        notify(
          form.id ? "Reserva actualizada" : "Reserva creada",
          `${form.customer} · ${form.hour}`,
        );
        setFormOpen(false);
      } catch (error) {
        notify("No se pudo guardar la reserva", errorMessage(error, "Inténtalo de nuevo."));
      } finally {
        setSaving(false);
      }
      return;
    }

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
                guests,
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
        guests,
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
    if (hasSession) {
      void (async () => {
        try {
          await apiUpdateReservationStatus(r.id, apiReservationStatusOf(status));
          await Promise.all([refreshReservations(dayFilter), refreshTables()]);
          notify(title, `${r.customer} · ${r.time}`);
        } catch (error) {
          notify("No se pudo actualizar la reserva", errorMessage(error, "Inténtalo de nuevo."));
        } finally {
          setPendingCancel(null);
          setPendingNoShow(null);
          setSelectedTable(null);
        }
      })();
      return;
    }
    setReservations(reservations.map((x) => (x.id === r.id ? { ...x, status } : x)));
    notify(title, `${r.customer} · ${r.time}`);
    setPendingCancel(null);
    setPendingNoShow(null);
    setSelectedTable(null);
  };

  const toggleBloqueo = (table: Table) => {
    if (hasSession) {
      if (!table.apiId) return;
      void (async () => {
        try {
          await apiUpdateTableStatus(table.apiId!, table.blocked ? "LIBRE" : "MANTENIMIENTO");
          await refreshTables();
          notify(table.blocked ? "Mesa desbloqueada" : "Mesa bloqueada", table.label);
        } catch (error) {
          notify("No se pudo cambiar la mesa", errorMessage(error, "Inténtalo de nuevo."));
        } finally {
          setConfirmTable(null);
          setSelectedTable(null);
        }
      })();
      return;
    }
    const next: TableStatus = table.status === "reservada" ? "libre" : "reservada";
    setTables(tables.map((t) => (t.id === table.id ? { ...t, status: next } : t)));
    notify(next === "reservada" ? "Mesa bloqueada" : "Mesa desbloqueada", table.label);
    setConfirmTable(null);
    setSelectedTable(null);
  };

  const alert = tablesError ?? reservationsError;

  return (
    <div>
      <ModuleSummary
        kpis={view === "mapa" ? summary.kpis : summary.kpis.slice(0, 3)}
        chartTitle={view === "mapa" ? "Ocupación del salón" : "Mesas por estado"}
        chartSubtitle={
          hasSession
            ? "Estados reales de la API: órdenes y reservas del día"
            : "Estados reales: cuenta abierta y reservas de hoy"
        }
        ariaLabel="Resumen de mesas"
      >
        <MiniDonut data={summary.donut} label="Distribución de mesas por estado" />
      </ModuleSummary>

      {alert && (
        <Card>
          <p className="text-sm text-persimmon-600">{alert}</p>
        </Card>
      )}

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
                <span className="text-xs text-ink-400">
                  {reservationsLoading
                    ? "Cargando…"
                    : `${dayRes.length} reserva(s)`}
                </span>
              </div>
            }
            right={
              <div className="flex items-center gap-3">
                <Badge tone={liveStatus === "connected" ? "success" : "neutral"} dot>
                  {liveLabel}
                </Badge>
                {canBook ? (
                  <Button onClick={() => openCreate()}>+ Nueva reserva</Button>
                ) : undefined}
              </div>
            }
          />
          {dayRes.length === 0 ? (
            <Card>
              <p className="text-sm text-ink-400">
                {reservationsLoading
                  ? "Cargando la agenda de la API…"
                  : "Sin reservas para esta fecha. Crea una para bloquear la mesa en el mapa."}
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
                      {r.code && <span className="block text-xs text-ink-400">{r.code}</span>}
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
                        {r.status === "por_confirmar" && canBook && (
                          <>
                            <button
                              type="button"
                              onClick={() => setStatus(r, "confirmada", "Reserva confirmada")}
                              className="text-ink-400 hover:text-ink-900 font-medium text-nav cursor-pointer"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(r)}
                              className="text-ink-400 hover:text-ink-900 font-medium text-nav cursor-pointer"
                            >
                              Editar
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
                        {r.status === "confirmada" && canBook && (
                          <>
                            {canOpen && (
                              <button
                                type="button"
                                onClick={() => markLlego(r)}
                                className="text-ink-400 hover:text-ink-900 font-medium text-nav cursor-pointer"
                              >
                                Llegó
                              </button>
                            )}
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
                        {(r.status === "cancelada" ||
                          r.status === "no_show" ||
                          r.status === "llego" ||
                          !canBook) && <span className="text-nav text-ink-400">—</span>}
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
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-sm text-ink-400">
              {tablesLoading ? "Cargando mesas de la API…" : `${derivedTables.length} mesas`}
            </p>
            <Badge tone={liveStatus === "connected" ? "success" : "neutral"} dot>
              {liveLabel}
            </Badge>
          </div>
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
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Reservada (hoy)
            </span>
            <span className="flex items-center gap-1.5 text-xs text-ink-600">
              <span className="w-2 h-2 rounded-full bg-ink-400" /> Bloqueada
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
              (r) =>
                r.tableId === table.id &&
                (r.status === "confirmada" || r.status === "por_confirmar"),
            );
            const totals = account ? accountTotals(account) : null;
            return (
              <div className="flex flex-col gap-4">
                <Badge tone={table.blocked ? "neutral" : statusTone[table.status]} dot>
                  {table.blocked ? "Bloqueada" : statusLabel[table.status]}
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
                  {table.status === "libre" && !table.blocked && canOpen && (
                    <Button onClick={() => openAccountFor(table, "")}>
                      Abrir cuenta
                    </Button>
                  )}
                  {res && res.status === "confirmada" && canOpen && (
                    <Button variant="secondary" onClick={() => markLlego(res)}>
                      Registrar llegada y abrir cuenta
                    </Button>
                  )}
                  {canBook && (
                    <Button variant="secondary" href="/app/modulos/reservas/agenda">
                      Gestionar reservas
                    </Button>
                  )}
                  {canOperate && table.status !== "ocupada" && (table.blocked || !res) && (
                    <Button variant="secondary" onClick={() => setConfirmTable(table)}>
                      {table.blocked ? "Desbloquear mesa" : "Bloquear mesa"}
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
        title={confirmTable?.blocked ? "Desbloquear mesa" : "Bloquear mesa"}
        message={
          confirmTable
            ? confirmTable.blocked
              ? `¿Desbloquear "${confirmTable.label}"? Volverá a estar disponible.`
              : `¿Bloquear "${confirmTable.label}"? No aceptará comensales hasta desbloquearla.`
            : ""
        }
        confirmLabel={confirmTable?.blocked ? "Desbloquear" : "Bloquear"}
        danger={!confirmTable?.blocked}
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
              <Button
                disabled={!form.customer.trim() || (hasSession && !form.tableId) || saving}
                onClick={() => void saveRes()}
              >
                {saving ? "Guardando…" : form.id ? "Guardar cambios" : "Crear reserva"}
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
              <Field
                label="Mesa"
                hint={hasSession ? "Obligatoria: la API valida aforo y solapamiento." : "Se bloquea automáticamente en el mapa."}
              >
                <Select
                  value={form.tableId}
                  onChange={(e) => setForm({ ...form, tableId: e.target.value })}
                >
                  <option value="">Por asignar</option>
                  {derivedTables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} · {t.seats} pers. · {t.blocked ? "Bloqueada" : statusLabel[t.status]}
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
