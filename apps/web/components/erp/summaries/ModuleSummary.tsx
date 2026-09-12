"use client";

import { KpiCard } from "@/components/ui/KpiCard";
import { ChartCard } from "@/components/erp/workspace-ui";

export type SummaryKpi = { label: string; value: string; hint?: string };

/** Encabezado-resumen compacto para vistas del admin.
 *  Patrón: KPIs (2/4 col) + 1 ChartCard h-44. La tabla/flujo existente va debajo sin cambios. */
export function ModuleSummary({
  kpis,
  chartTitle,
  chartSubtitle,
  children,
  ariaLabel,
}: {
  kpis: SummaryKpi[];
  chartTitle: string;
  chartSubtitle?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  if (kpis.length === 0) return null;
  return (
    <section aria-label={ariaLabel ?? chartTitle} className="mb-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} hint={k.hint} />
        ))}
      </div>
      <ChartCard title={chartTitle} subtitle={chartSubtitle}>
        {children}
      </ChartCard>
    </section>
  );
}
