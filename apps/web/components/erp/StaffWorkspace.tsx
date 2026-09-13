"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import { initialAttendance, initialEmployees } from "@/lib/erp";
import { KpiCard } from "@/components/ui/KpiCard";
import { ChartCard, HubBlocks, type HubLink } from "./workspace-ui";

const attendanceByDay = [
  { name: "Lun", v: 4 }, { name: "Mar", v: 3 }, { name: "Mié", v: 4 },
  { name: "Jue", v: 3 }, { name: "Vie", v: 4 },
];
const tick = { fontSize: 12, fill: "var(--c-mute)" };

/** Workspace Personal: KPIs + gráfico + accesos + columnas. */
export function StaffWorkspace() {
  const onShift = initialEmployees.filter((e) => e.onShift);
  const marks = initialAttendance.length;
  const present = initialAttendance.filter((a) => a.present).length;
  const rate = marks === 0 ? 0 : Math.round((present / marks) * 100);

  const acceso: HubLink[] = [
    { label: "Marcar asistencia", href: "/app/modulos/personal/asistencia" },
    { label: "Repartir propinas", href: "/app/modulos/personal/propinas" },
  ];
  const informes: HubLink[] = [
    { label: "Directorio", href: "/app/modulos/personal/directorio" },
    { label: "Roles", href: "/app/modulos/personal/roles" },
    { label: "Turnos", href: "/app/modulos/personal/turnos" },
    { label: "Asistencia semanal", href: "/app/modulos/personal/asistencia" },
  ];

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

      <HubBlocks acceso={acceso} informes={informes} />
    </div>
  );
}
