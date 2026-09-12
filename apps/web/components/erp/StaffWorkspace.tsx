"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import { initialAttendance, initialEmployees } from "@/lib/erp";
import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ChartCard, ColumnLink, LinkColumn, QuickLink } from "./workspace-ui";

const attendanceByDay = [
  { name: "Lun", v: 4 }, { name: "Mar", v: 3 }, { name: "Mié", v: 4 },
  { name: "Jue", v: 3 }, { name: "Vie", v: 4 },
];
const tick = { fontSize: 12, fill: "var(--c-mute)" };

/** Workspace Trabajadores: KPIs + gráfico + accesos + columnas. */
export function StaffWorkspace() {
  const { roles } = useModules();
  const onShift = initialEmployees.filter((e) => e.onShift);
  const marks = initialAttendance.length;
  const present = initialAttendance.filter((a) => a.present).length;
  const rate = marks === 0 ? 0 : Math.round((present / marks) * 100);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KpiCard label="En turno ahora" value={`${onShift.length}/${initialEmployees.length}`} hint="colaboradores activos" />
        <KpiCard label="Asistencia semanal" value={`${rate}%`} hint="presentes sobre turnos" />
        <KpiCard label="Pozo de propinas" value="S/ 86.50" hint="acumulado de hoy" />
      </div>

      <ChartCard title="Presentes por día" subtitle="Semana actual (Lun–Vie)">
        <div className="h-full w-full text-ink-600">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={attendanceByDay} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tick} dy={10} />
            <Bar dataKey="v" fill="currentColor" radius={[4, 4, 0, 0]} barSize={28} />
          </BarChart>
        </ResponsiveContainer>
        </div>
      </ChartCard>

      <h3 className="text-sm font-medium text-ink-900 mb-3">Acceso rápido</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 mb-10">
        <QuickLink
          href="/app/modulos/trabajadores/directorio"
          label="Directorio"
          badge={
            <Badge tone="success" dot>
              {onShift.length} en turno
            </Badge>
          }
        />
        <QuickLink
          href="/app/modulos/trabajadores/roles"
          label="Roles"
          badge={<Badge tone="neutral">{roles.length}</Badge>}
        />
        <QuickLink href="/app/modulos/trabajadores/turnos" label="Turnos" />
        <QuickLink href="/app/modulos/trabajadores/asistencia" label="Asistencia" badge={<Badge tone="neutral">{rate}%</Badge>} />
        <QuickLink href="/app/modulos/trabajadores/propinas" label="Propinas" />
      </div>

      <h3 className="text-sm font-medium text-ink-900 mb-4">Másteres e informes</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
        <LinkColumn title="Equipo">
          <ColumnLink href="/app/modulos/trabajadores/directorio" label="Directorio" />
          <ColumnLink href="/app/modulos/trabajadores/roles" label="Roles" />
          <ColumnLink href="/app/modulos/trabajadores/turnos" label="Turnos" />
        </LinkColumn>
        <LinkColumn title="Transacciones">
          <ColumnLink href="/app/modulos/trabajadores/asistencia" label="Marcar asistencia" />
          <ColumnLink href="/app/modulos/trabajadores/propinas" label="Repartir propinas" />
        </LinkColumn>
        <LinkColumn title="Informes">
          <ColumnLink href="/app/modulos/trabajadores/asistencia" label="Asistencia semanal" />
        </LinkColumn>
      </div>
    </div>
  );
}
