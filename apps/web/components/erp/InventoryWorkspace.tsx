"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import { KpiCard } from "@/components/ui/KpiCard";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ChartCard, ColumnLink, LinkColumn } from "./workspace-ui";

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

      <h3 className="text-sm font-medium text-ink-900 mb-4">Másteres e informes</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
        <LinkColumn title="Catálogo">
          <ColumnLink href="/app/modulos/inventario/stock" label="Insumos" />
          <ColumnLink href="/app/modulos/inventario/stock" label="Escandallos" />
        </LinkColumn>
        <LinkColumn title="Transacciones">
          <ColumnLink href="/app/modulos/inventario/movimientos?tipo=Entrada" label="Entradas" />
          <ColumnLink href="/app/modulos/inventario/movimientos?tipo=Salida" label="Salidas y ajustes" />
        </LinkColumn>
        <LinkColumn title="Informes">
          <ColumnLink href="/app/modulos/inventario/movimientos" label="Kardex" />
          <ColumnLink href="/app/modulos/inventario/stock?filtro=critico" label="Stock crítico" />
        </LinkColumn>
      </div>
    </div>
  );
}
