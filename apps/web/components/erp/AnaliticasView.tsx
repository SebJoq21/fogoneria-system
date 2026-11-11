"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import { KpiCard } from "@/components/ui/KpiCard";
import { ChartCard } from "@/components/erp/workspace-ui";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { fmtMoney } from "@/lib/domain";
import {
  diaCorto,
  getPnl,
  getPnlDaily,
  getSalesByMethod,
  getTopDishes,
  ultimosDias,
  type ApiPnl,
  type ApiPnlDay,
  type ApiSalesMethod,
  type ApiTopDish,
} from "@/lib/bi-api";

const salesByDayDemo = [
  { name: "Lun", v: 320 }, { name: "Mar", v: 410 }, { name: "Mié", v: 380 },
  { name: "Jue", v: 520 }, { name: "Vie", v: 740 }, { name: "Sáb", v: 890 }, { name: "Dom", v: 610 },
];
const topDishesDemo = [
  { name: "Lomo Saltado", qty: 86 },
  { name: "Ceviche Clásico", qty: 74 },
  { name: "Ají de Gallina", qty: 51 },
  { name: "Pisco Sour", qty: 47 },
];
const tick = { fontSize: 12, fill: "var(--c-mute)" };

/** Analíticas: P&L, ventas por día y platos top (AYCDS-45). */
export function AnaliticasView() {
  const { hasSession, expenses } = useModules();
  const [pnl, setPnl] = useState<ApiPnl | null>(null);
  const [daily, setDaily] = useState<ApiPnlDay[]>([]);
  const [top, setTop] = useState<ApiTopDish[]>([]);
  const [metodos, setMetodos] = useState<ApiSalesMethod[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSession) return;
    const controller = new AbortController();
    const rango = ultimosDias(7);
    // Diferido al siguiente tick: el efecto no debe disparar renders en cascada.
    const timer = setTimeout(() => {
      Promise.all([
        getPnl(rango, controller.signal),
        getPnlDaily(rango, controller.signal),
        getTopDishes({ ...rango, limit: 5 }, controller.signal),
        getSalesByMethod(rango, controller.signal),
      ])
        .then(([resumen, serie, ranking, cobros]) => {
          setPnl(resumen);
          setDaily(serie.items);
          setTop(ranking.items);
          setMetodos(cobros.items);
        })
        .catch((problema: unknown) => {
          if (controller.signal.aborted) return;
          setError(problema instanceof Error ? problema.message : "No se pudieron cargar las analíticas.");
        });
    }, 0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [hasSession]);

  const demoExpenses = useMemo(
    () => expenses.reduce((total, gasto) => total + (Number(gasto.amount.replace("$", "")) || 0), 0),
    [expenses],
  );

  const ventas = pnl?.ventas ?? salesByDayDemo.reduce((suma, dia) => suma + dia.v, 0);
  const gastos = pnl?.gastos ?? demoExpenses;
  const margen = pnl?.margen ?? ventas - gastos;
  const chart = daily.length
    ? daily.map((dia) => ({ name: diaCorto(dia.fecha), v: dia.ventas }))
    : salesByDayDemo;
  const platos = top.length
    ? top.map((plato) => ({ name: plato.nombre, qty: plato.unidades, ingresos: plato.ingresos }))
    : topDishesDemo.map((plato) => ({ ...plato, ingresos: 0 }));

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KpiCard
          label="Ventas 7 días"
          value={fmtMoney(ventas)}
          hint={pnl ? `comprobado ${fmtMoney(pnl.comprobado)}` : "demo"}
        />
        <KpiCard label="Margen" value={fmtMoney(margen)} hint={`gastos ${fmtMoney(gastos)}`} />
        <KpiCard
          label="Propinas"
          value={fmtMoney(pnl?.propinas ?? 0)}
          hint="traspaso al personal, no es ingreso"
        />
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <div className="scroll-mt-4">
        <ChartCard title="Ventas por día" subtitle="Últimos 7 días (día de Lima)">
          <div className="h-full w-full text-primary">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
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
                <TH right>Ingresos</TH>
              </tr>
            </THead>
            <tbody>
              {platos.map((plato) => (
                <TR key={plato.name}>
                  <TD tone="strong">{plato.name}</TD>
                  <TD right className="tnum">{plato.qty}</TD>
                  <TD right className="tnum">{fmtMoney(plato.ingresos)}</TD>
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
                <TD tone="strong" right className="tnum">{fmtMoney(ventas)}</TD>
              </TR>
              <TR>
                <TD>Gastos registrados</TD>
                <TD tone="strong" right className="tnum">-{fmtMoney(gastos)}</TD>
              </TR>
              {pnl && pnl.ventaSinComprobante > 0 && (
                <TR>
                  <TD>Venta sin comprobante</TD>
                  <TD right className="tnum">{fmtMoney(pnl.ventaSinComprobante)}</TD>
                </TR>
              )}
              <TR>
                <TD tone="strong">Margen</TD>
                <TD tone="strong" right className="tnum">{fmtMoney(margen)}</TD>
              </TR>
            </tbody>
          </TableCard>
        </div>
        <div className="scroll-mt-4">
          <h3 className="text-sm font-medium text-ink-900 mb-3">Cobros por método</h3>
          <TableCard>
            <THead>
              <tr>
                <TH>Método</TH>
                <TH right>Cobros</TH>
                <TH right>Monto</TH>
              </tr>
            </THead>
            <tbody>
              {metodos.length === 0 ? (
                <TR>
                  <TD tone="muted">Sin cobros en el rango.</TD>
                  <TD>—</TD>
                  <TD>—</TD>
                </TR>
              ) : (
                metodos.map((metodo) => (
                  <TR key={metodo.metodo}>
                    <TD tone="strong">{metodo.metodo}</TD>
                    <TD right className="tnum">{metodo.cobros}</TD>
                    <TD right className="tnum">{fmtMoney(metodo.monto)}</TD>
                  </TR>
                ))
              )}
            </tbody>
          </TableCard>
        </div>
      </div>
    </div>
  );
}
