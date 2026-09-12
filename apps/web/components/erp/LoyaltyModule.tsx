"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/fields";
import { useModules } from "@/components/dashboard/ModulesProvider";

/** Fidelización: KPIs + regla de puntos. Cupones y clientes viven en sus módulos. */
export function LoyaltyModule() {
  const { customers } = useModules();
  const [pointsPerDollar, setPointsPerDollar] = useState(1);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Puntos circulando" value="12,480" hint={`en ${customers.length} clientes`} />
        <KpiCard label="Cupones canjeados" value="135" hint="este mes" />
        <KpiCard label="Clientes frecuentes" value={String(customers.length)} hint="registrados" />
      </div>

      <Card className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <p className="text-sm text-ink-600 flex-1">
          Por cada <strong className="text-ink-900">$1.00</strong> gastado, el cliente recibe
        </p>
        <div className="flex items-center gap-2">
          <TextInput
            type="number"
            min={1}
            value={pointsPerDollar}
            onChange={(e) => setPointsPerDollar(Math.max(1, Number(e.target.value) || 1))}
            className="w-20 text-center"
            aria-label="Puntos por dólar"
          />
          <span className="text-sm text-ink-600">punto{pointsPerDollar === 1 ? "" : "s"}</span>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card
          href="/app/clientes"
          className="flex items-center justify-between hover:border-ink-900/30 transition-colors"
        >
          <span className="text-sm font-medium text-ink-900">Ver base de clientes</span>
          <ArrowUpRight size={14} className="text-ink-400" />
        </Card>
        <Card
          href="/app/promociones"
          className="flex items-center justify-between hover:border-ink-900/30 transition-colors"
        >
          <span className="text-sm font-medium text-ink-900">Gestionar cupones</span>
          <ArrowUpRight size={14} className="text-ink-400" />
        </Card>
      </div>
    </div>
  );
}
