'use client';

import { useMemo } from 'react';
import { Bar, BarChart, ResponsiveContainer, XAxis } from 'recharts';
import { calcularMargen, etiquetaMetodoPago } from '@fogoneria/contracts/bi';
import { diaCorto } from '@fogoneria/kernel';
import { KpiCard } from '@/components/ui/KpiCard';
import { TableCard, THead, TH, TR, TD } from '@/components/ui/data-table';
import { ChartCard } from '@/components/dashboard/workspace-ui';
import { useModules } from '@/components/dashboard/ModulesProvider';
import { fmtMoney } from '@/lib/domain';
import { useBi } from './hooks';

const ventasPorDiaDemo = [
  { name: 'Lun', v: 320 },
  { name: 'Mar', v: 410 },
  { name: 'Mié', v: 380 },
  { name: 'Jue', v: 520 },
  { name: 'Vie', v: 740 },
  { name: 'Sáb', v: 890 },
  { name: 'Dom', v: 610 },
];
const platosDemo = [
  { name: 'Lomo Saltado', qty: 86 },
  { name: 'Ceviche Clásico', qty: 74 },
  { name: 'Ají de Gallina', qty: 51 },
  { name: 'Pisco Sour', qty: 47 },
];
const tick = { fontSize: 12, fill: 'var(--c-mute)' };

/** Analíticas: P&L, ventas por día, platos top y cobros por método (AYCDS-45). */
export function AnaliticasPage() {
  const { expenses } = useModules();
  const { pnl, serie, platos, metodos, error } = useBi();

  const gastosDemo = useMemo(
    () =>
      expenses.reduce(
        (total, gasto) => total + (Number(gasto.amount.replace('$', '')) || 0),
        0,
      ),
    [expenses],
  );

  const ventas =
    pnl?.ventas ?? ventasPorDiaDemo.reduce((suma, dia) => suma + dia.v, 0);
  const gastos = pnl?.gastos ?? gastosDemo;
  const margen = pnl?.margen ?? calcularMargen(ventas, gastos);
  const chart = serie.length
    ? serie.map((dia) => ({ name: diaCorto(dia.fecha), v: dia.ventas }))
    : ventasPorDiaDemo;
  const top = platos.length
    ? platos.map((plato) => ({
        name: plato.nombre,
        qty: plato.unidades,
        ingresos: plato.ingresos,
      }))
    : platosDemo.map((plato) => ({ ...plato, ingresos: 0 }));

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KpiCard
          label="Ventas 7 días"
          value={fmtMoney(ventas)}
          hint={pnl ? `comprobado ${fmtMoney(pnl.comprobado)}` : 'demo'}
        />
        <KpiCard
          label="Margen"
          value={fmtMoney(margen)}
          hint={`gastos ${fmtMoney(gastos)}`}
        />
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
              {top.map((plato) => (
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
                    <TD tone="strong">{etiquetaMetodoPago(metodo.metodo)}</TD>
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
