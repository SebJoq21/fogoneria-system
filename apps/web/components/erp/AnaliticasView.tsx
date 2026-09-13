"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import { KpiCard } from "@/components/ui/KpiCard";
import { ChartCard } from "@/components/erp/workspace-ui";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";

const salesByDay = [
  { name: "Lun", v: 320 }, { name: "Mar", v: 410 }, { name: "Mié", v: 380 },
  { name: "Jue", v: 520 }, { name: "Vie", v: 740 }, { name: "Sáb", v: 890 }, { name: "Dom", v: 610 },
];
const tick = { fontSize: 12, fill: "var(--c-mute)" };

const topDishes = [
  { name: "Lomo Saltado", qty: 86 },
  { name: "Ceviche Clásico", qty: 74 },
  { name: "Ají de Gallina", qty: 51 },
  { name: "Pisco Sour", qty: 47 },
];

/** Analíticas: ventas, platos top y gastos vs ingresos. */
export function AnaliticasView() {
  const { expenses } = useModules();
  const totalSales = salesByDay.reduce((s, d) => s + d.v, 0);
  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount.replace("$", "")) || 0), 0);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KpiCard label="Ventas 7 días" value={`$${totalSales.toLocaleString("es-PE")}.00`} hint="+12% vs semana anterior" />
        <KpiCard label="Ticket promedio" value="$15.20" hint="32 pedidos hoy" />
        <KpiCard label="Gastos registrados" value={`$${totalExpenses.toFixed(2)}`} hint="ver detalle en Gastos" />
      </div>

      <div className="scroll-mt-4">
      <ChartCard title="Ventas por día" subtitle="Últimos 7 días">
        <div className="h-full w-full text-primary">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={salesByDay} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tick} dy={10} />
              <Bar dataKey="v" fill="currentColor" radius={[4, 4, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="scroll-mt-4">
          <h3 className="text-sm font-medium text-ink-900 mb-3">Platos más vendidos</h3>
          <TableCard>
            <THead>
              <tr>
                <TH>Plato</TH>
                <TH right>Porciones</TH>
              </tr>
            </THead>
            <tbody>
              {topDishes.map((d) => (
                <TR key={d.name}>
                  <TD tone="strong">{d.name}</TD>
                  <TD right className="tnum">{d.qty}</TD>
                </TR>
              ))}
            </tbody>
          </TableCard>
        </div>
        <div className="scroll-mt-4">
          <h3 className="text-sm font-medium text-ink-900 mb-3">Gastos vs ingresos</h3>
          <TableCard>
            <THead>
              <tr>
                <TH>Concepto</TH>
                <TH right>Monto</TH>
              </tr>
            </THead>
            <tbody>
              <TR>
                <TD>Ventas 7 días</TD>
                <TD tone="strong" right className="tnum">${totalSales.toLocaleString("es-PE")}.00</TD>
              </TR>
              <TR>
                <TD>Gastos registrados</TD>
                <TD tone="strong" right className="tnum">-${totalExpenses.toFixed(2)}</TD>
              </TR>
              <TR>
                <TD tone="strong">Margen estimado</TD>
                <TD tone="strong" right className="tnum">
                  ${(totalSales - totalExpenses).toLocaleString("es-PE", { maximumFractionDigits: 2 })}
                </TD>
              </TR>
            </tbody>
          </TableCard>
        </div>
      </div>
    </div>
  );
}
