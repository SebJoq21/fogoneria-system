"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/fields";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";
import { clientesSummary, promosSummary } from "@/components/erp/summaries/summary-selectors";

/** Fidelización: KPIs + regla de puntos. Cupones y clientes viven en sus módulos. */
export function LoyaltyModule() {
  const { customers, coupons } = useModules();
  const [pointsPerDollar, setPointsPerDollar] = useState(1);

  const summary = useMemo(() => {
    const c = clientesSummary(customers);
    const p = promosSummary(coupons, 0);
    const points = customers.reduce((s, x) => s + x.points, 0);
    const redeemed = coupons.reduce((s, x) => s + x.used, 0);
    return {
      kpis: [
        { label: "Puntos circulando", value: points.toLocaleString("es-PE"), hint: `en ${customers.length} clientes` },
        { label: "Cupones canjeados", value: String(redeemed), hint: "acumulados" },
        c.kpis[0],
        p.kpis[0],
      ],
      bars: p.bars,
    };
  }, [customers, coupons]);

  return (
    <div>
      <ModuleSummary
        kpis={summary.kpis}
        chartTitle="Canjes por cupón"
        chartSubtitle="Qué premia la lealtad de tus clientes"
        ariaLabel="Resumen de fidelización"
      >
        <MiniBars data={summary.bars} label="Canjes por cupón" />
      </ModuleSummary>

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
    </div>
  );
}
