"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ChartCard, ColumnLink, LinkColumn, QuickLink } from "./workspace-ui";

const redeemedByMonth = [
  { name: "Jun", v: 42 }, { name: "Jul", v: 68 }, { name: "Ago", v: 55 },
  { name: "Sep", v: 91 }, { name: "Oct", v: 135 },
];
const tick = { fontSize: 12, fill: "var(--c-mute)" };

/** Workspace Fidelización: KPIs + gráfico + accesos + columnas. */
export function LoyaltyWorkspace() {
  const { customers, coupons } = useModules();
  const expiring = coupons.filter((c) => c.limit - c.used <= 10).length;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KpiCard label="Puntos circulando" value="12,480" hint={`en ${customers.length} clientes`} />
        <KpiCard label="Cupones canjeados" value="135" hint="este mes" />
        <KpiCard label="Clientes frecuentes" value={String(customers.length)} hint="registrados" />
      </div>

      <ChartCard title="Canjes por mes" subtitle="Cupones redimidos">
        <div className="h-full w-full text-primary">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={redeemedByMonth} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tick} dy={10} />
            <Bar dataKey="v" fill="currentColor" radius={[4, 4, 0, 0]} barSize={28} />
          </BarChart>
        </ResponsiveContainer>
        </div>
      </ChartCard>

      <h3 className="text-sm font-medium text-ink-900 mb-3">Acceso rápido</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 mb-10">
        <QuickLink
          href="/app/clientes"
          label="Clientes"
          badge={<Badge tone="neutral">{customers.length}</Badge>}
        />
        <QuickLink
          href="/app/promociones"
          label="Cupones"
          badge={<Badge tone="neutral">{coupons.length}</Badge>}
        />
        {expiring > 0 && (
          <QuickLink
            href="/app/promociones"
            label="Por agotar cupo"
            badge={<Badge tone="warning">{expiring}</Badge>}
          />
        )}
      </div>

      <h3 className="text-sm font-medium text-ink-900 mb-4">Másteres e informes</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
        <LinkColumn title="Catálogo">
          <ColumnLink href="/app/clientes" label="Clientes" />
          <ColumnLink href="/app/promociones" label="Cupones" />
        </LinkColumn>
        <LinkColumn title="Transacciones">
          <ColumnLink href="/app/promociones" label="Crear cupón" />
          <ColumnLink href="/app/modulos/fidelizacion" label="Regla de puntos" />
        </LinkColumn>
        <LinkColumn title="Informes">
          <ColumnLink href="/app/clientes" label="Clientes por segmento" />
        </LinkColumn>
      </div>
    </div>
  );
}
