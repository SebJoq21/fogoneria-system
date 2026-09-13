"use client";

import { useMemo, useState } from "react";
import {
  type Table,
  type TableStatus,
} from "@/lib/erp";
import { Badge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { canChangeTableStatus } from "@/lib/permissions";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniDonut } from "@/components/erp/summaries/charts";
import { mesasSummary } from "@/components/erp/summaries/summary-selectors";

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

function TableNode({
  table,
  onSelect,
}: {
  table: Table;
  onSelect: () => void;
}) {
  const color =
    table.status === "libre"
      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
      : table.status === "ocupada"
        ? "bg-red-50 border-red-300 text-red-700"
        : "bg-amber-50 border-amber-300 text-amber-700";
  const shape =
    table.shape === "round"
      ? "rounded-full w-20 h-20"
      : "rounded-2xl w-28 h-20";
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

export function BookingsModule({ view = "mapa" }: { view?: "agenda" | "mapa" }) {
  const { tables, setTables, reservations, currentUser } = useModules();
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [confirmTable, setConfirmTable] = useState<Table | null>(null);
  const canOperate = canChangeTableStatus(currentUser?.role);
  const summary = useMemo(() => mesasSummary(tables), [tables]);

  const reservationFor = (tableId: number) =>
    reservations.find((r) => r.tableId === tableId);

  const cycleStatus = (table: Table) => {
    if (!canOperate) return;
    const next: TableStatus =
      table.status === "libre" ? "ocupada" : table.status === "ocupada" ? "reservada" : "libre";
    setTables(tables.map((t) => (t.id === table.id ? { ...t, status: next } : t)));
    setSelectedTable({ ...table, status: next });
  };

  return (
    <div>
      <ModuleSummary
        kpis={view === "mapa" ? summary.kpis : summary.kpis.slice(0, 3)}
        chartTitle={view === "mapa" ? "Ocupación del salón" : "Mesas por estado"}
        chartSubtitle="Primera vista de tu salón en tiempo real"
        ariaLabel="Resumen de mesas"
      >
        <MiniDonut data={summary.donut} label="Distribución de mesas por estado" />
      </ModuleSummary>
      {view === "agenda" && (
        <TableCard>
          <THead>
            <tr>
              <TH>Cliente</TH>
              <TH>Mesa</TH>
              <TH>Hora</TH>
              <TH>Comensales</TH>
            </tr>
          </THead>
          <tbody>
            {reservations.map((r) => (
              <TR key={r.id}>
                <TD tone="strong">{r.customer}</TD>
                <TD>Mesa {r.tableId}</TD>
                <TD nowrap>{r.time}</TD>
                <TD className="tnum">{r.guests}</TD>
              </TR>
            ))}
          </tbody>
        </TableCard>
      )}

      {view === "mapa" && (
        <div>
          <Card>
            <div className="flex flex-wrap gap-4 justify-center">
              {tables.map((t) => (
                <TableNode key={t.id} table={t} onSelect={() => setSelectedTable(t)} />
              ))}
            </div>
          </Card>
          <div className="flex flex-wrap gap-4 mt-4">
            <span className="flex items-center gap-1.5 text-xs text-ink-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Libre
            </span>
            <span className="flex items-center gap-1.5 text-xs text-ink-600">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Ocupada en servicio
            </span>
            <span className="flex items-center gap-1.5 text-xs text-ink-600">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Reservada siguiente turno
            </span>
          </div>
        </div>
      )}

      <Drawer
        open={selectedTable !== null}
        onClose={() => setSelectedTable(null)}
        title={selectedTable ? `Detalle · ${selectedTable.label}` : ""}
      >
        {selectedTable && (
          <div className="flex flex-col gap-4">
            <Badge tone={statusTone[selectedTable.status]} dot>
              {statusLabel[selectedTable.status]}
            </Badge>
            {(() => {
              const r = reservationFor(selectedTable.id);
              if (!r) {
                return (
                  <p className="text-sm text-ink-400">
                    Sin reserva asociada a esta mesa.
                  </p>
                );
              }
              return (
                <dl className="flex flex-col gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-ink-400 mb-0.5">Cliente</dt>
                    <dd className="font-medium text-ink-900">{r.customer}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400 mb-0.5">Comensales</dt>
                    <dd className="text-ink-900">{r.guests} personas</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400 mb-0.5">Teléfono</dt>
                    <dd className="text-ink-900">{r.phone}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400 mb-0.5">Hora</dt>
                    <dd className="text-ink-900">{r.time}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400 mb-0.5">Notas</dt>
                    <dd className="text-ink-600">{r.notes}</dd>
                  </div>
                </dl>
              );
            })()}
            {canOperate ? (
              <Button
                onClick={() => setConfirmTable(selectedTable)}
                className="mt-2"
              >
                Cambiar estado de mesa
              </Button>
            ) : (
              <p className="text-xs text-ink-400">
                Vista de lectura: solo la sucursal puede cambiar estados.
              </p>
            )}
          </div>
        )}
      </Drawer>
      <ConfirmDialog
        open={confirmTable !== null}
        title="Cambiar estado de mesa"
        message={
          confirmTable
            ? `¿Cambiar "${confirmTable.label}" de ${statusLabel[confirmTable.status]} al siguiente estado?`
            : ""
        }
        onConfirm={() => {
          if (confirmTable) cycleStatus(confirmTable);
          setConfirmTable(null);
        }}
        onCancel={() => setConfirmTable(null)}
      />
    </div>
  );
}
