"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import { KpiCard } from "@/components/ui/KpiCard";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ChartCard, HubBlocks, type HubLink } from "./workspace-ui";

const tick = { fontSize: 12, fill: "var(--c-mute)" };

/** Workspace Inventarios: KPIs + gráfico + columnas. */
export function InventoryWorkspace() {
  const { ingredients, movements } = useModules();
  const critical = ingredients.filter((i) => i.state !== "Óptimo").length;

  const byCategory = ingredients.reduce<Record<string, number>>((acc, i) => {
    acc[i.category] = (acc[i.category] ?? 0) + 1;
    return acc;
  }, {});
  const chartData = Object.entries(byCategory).map(([name, v]) => ({ name, v }));

  const acceso: HubLink[] = [
    { label: "Entradas", href: "/app/modulos/inventario/movimientos?tipo=Entrada" },
    { label: "Salidas y ajustes", href: "/app/modulos/inventario/movimientos?tipo=Salida" },
  ];
  const informes: HubLink[] = [
    { label: "Insumos", href: "/app/modulos/inventario/stock" },
    { label: "Escandallos", href: "/app/modulos/inventario/stock" },
    { label: "Kardex", href: "/app/modulos/inventario/movimientos" },
    { label: "Stock crítico", href: "/app/modulos/inventario/stock?filtro=critico" },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KpiCard label="Insumos registrados" value={String(ingredients.length)} hint={`${critical} en nivel crítico`} />
        <KpiCard label="Movimientos hoy" value={String(movements.length)} hint="entradas, salidas y ajustes" />
        <KpiCard label="En crítico" value={String(critical)} hint="por reponer" />
      </div>

      <ChartCard title="Insumos por categoría" subtitle="Maestro actual">
        <div className="h-full w-full text-primary">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tick} dy={10} interval={0} />
            <Bar dataKey="v" fill="currentColor" radius={[4, 4, 0, 0]} barSize={28} />
          </BarChart>
        </ResponsiveContainer>
        </div>
      </ChartCard>

      <HubBlocks acceso={acceso} informes={informes} />
    </div>
  );
}
