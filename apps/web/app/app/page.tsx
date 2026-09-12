import { MetricsCharts } from "@/components/dashboard/MetricsCharts";
import { Button } from "@/components/ui/Button";
import { KpiCard } from "@/components/ui/KpiCard";

/** Dashboard: métricas resumidas de hoy. */
export default function DashboardHome() {
  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-section font-medium text-ink-900">Hoy en tu restaurante</h2>
          <p className="text-sm text-ink-400 mt-1">Resumen de la operación del día.</p>
        </div>
        <Button
          href="/app/ordenes"
          className="w-max"
        >
          Ver pedidos en vivo
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Ventas hoy" value="$486.00" hint="+18% vs ayer" />
        <KpiCard label="Pedidos hoy" value="32" hint="6 en cocina ahora" />
        <KpiCard label="Ticket promedio" value="$15.20" />
        <KpiCard label="Reservas hoy" value="9" hint="3 por confirmar" />
      </div>

      <MetricsCharts />
    </div>
  );
}
