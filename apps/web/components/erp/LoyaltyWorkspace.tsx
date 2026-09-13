"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import { KpiCard } from "@/components/ui/KpiCard";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ChartCard, HubBlocks, type HubLink } from "./workspace-ui";

const tick = { fontSize: 12, fill: "var(--c-mute)" };

/** Workspace Fidelización: KPIs + gráfico + columnas. */
export function LoyaltyWorkspace() {
  const { customers, coupons } = useModules();
  const points = customers.reduce((s, c) => s + c.points, 0);
  const redeemed = coupons.reduce((s, c) => s + c.used, 0);
  const chartData = coupons.slice(0, 5).map((c) => ({ name: c.code.slice(0, 6), v: c.used }));

  const acceso: HubLink[] = [
    { label: "Crear cupón", href: "/app/promociones?nuevo=1" },
    { label: "Regla de puntos", href: "/app/modulos/fidelizacion/regla" },
  ];
  const informes: HubLink[] = [
    { label: "Comensales", href: "/app/clientes" },
    { label: "Cupones", href: "/app/promociones" },
    { label: "Clientes por segmento", href: "/app/clientes?segmento=todos" },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KpiCard label="Puntos circulando" value={points.toLocaleString("es-PE")} hint={`en ${customers.length} clientes`} />
        <KpiCard label="Cupones canjeados" value={String(redeemed)} hint="acumulados" />
        <KpiCard label="Clientes frecuentes" value={String(customers.length)} hint="registrados" />
      </div>

      <ChartCard title="Canjes por cupón" subtitle="Uso real del maestro">
        <div className="h-full w-full text-primary">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
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
