"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import { initialReservations, initialTables } from "@/lib/erp";
import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { ChartCard, ColumnLink, LinkColumn, QuickLink } from "./workspace-ui";

const bookingsByDay = [
  { name: "Lun", v: 4 }, { name: "Mar", v: 6 }, { name: "Mié", v: 5 },
  { name: "Jue", v: 8 }, { name: "Vie", v: 12 }, { name: "Sáb", v: 15 }, { name: "Dom", v: 9 },
];
const tick = { fontSize: 12, fill: "var(--c-mute)" };

/** Workspace Reservas: KPIs + gráfico + accesos + columnas. */
export function BookingsWorkspace() {
  const occupied = initialTables.filter((t) => t.status === "ocupada").length;
  const free = initialTables.filter((t) => t.status === "libre").length;
  const occupancy = Math.round((occupied / initialTables.length) * 100);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KpiCard label="Reservas hoy" value={String(initialReservations.length)} hint="2 por confirmar" />
        <KpiCard label="Ocupación actual" value={`${occupancy}%`} hint={`${occupied} de ${initialTables.length} mesas`} />
        <KpiCard label="Mesas libres" value={String(free)} hint="ahora mismo" />
      </div>

      <ChartCard title="Reservas por día" subtitle="Última semana">
        <div className="h-full w-full text-ink-600">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bookingsByDay} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tick} dy={10} />
            <Bar dataKey="v" fill="currentColor" radius={[4, 4, 0, 0]} barSize={24} />
          </BarChart>
        </ResponsiveContainer>
        </div>
      </ChartCard>

      <h3 className="text-sm font-medium text-ink-900 mb-3">Acceso rápido</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 mb-10">
        <QuickLink
          href="/app/mesas/maestro"
          label="Mesas"
          badge={<Badge tone="neutral">{initialTables.length}</Badge>}
        />
        <QuickLink
          href="/app/mesas"
          label="Mapa de mesas"
          badge={<Badge tone="success" dot>{free} libres</Badge>}
        />
        <QuickLink
          href="/app/modulos/reservas/agenda"
          label="Agenda"
          badge={<Badge tone="neutral">{initialReservations.length}</Badge>}
        />
      </div>

      <h3 className="text-sm font-medium text-ink-900 mb-4">Másteres e informes</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
        <LinkColumn title="Salón">
          <ColumnLink href="/app/mesas/maestro" label="Mesas" />
          <ColumnLink href="/app/mesas" label="Mapa de mesas" />
          <ColumnLink href="/app/modulos/reservas/agenda" label="Agenda" />
        </LinkColumn>
        <LinkColumn title="Transacciones">
          <ColumnLink href="/app/modulos/reservas/agenda" label="Confirmar reservas" />
        </LinkColumn>
        <LinkColumn title="Informes">
          <ColumnLink href="/app/modulos/reservas/agenda" label="Reservas por día" />
        </LinkColumn>
      </div>
    </div>
  );
}
