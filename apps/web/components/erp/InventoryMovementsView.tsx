"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";
import { kardexSummary } from "@/components/erp/summaries/summary-selectors";
import { useModules } from "@/components/dashboard/ModulesProvider";

const typeTone = { Entrada: "success", Salida: "neutral", Ajuste: "warning" } as const;

/** Inventarios · Movimientos: kardex de entradas, salidas y ajustes. */
export function InventoryMovementsView() {
  const { movements } = useModules();
  const [filter, setFilter] = useState<"Todos" | "Entrada" | "Salida" | "Ajuste">(() => {
    try {
      if (typeof window === "undefined") return "Todos";
      const t = new URLSearchParams(window.location.search).get("tipo");
      return t === "Entrada" || t === "Salida" || t === "Ajuste" ? t : "Todos";
    } catch {
      return "Todos";
    }
  });

  const rows =
    filter === "Todos" ? movements : movements.filter((m) => m.type === filter);

  const summary = useMemo(() => kardexSummary(movements), [movements]);

  return (
    <div>
      <ModuleSummary
        kpis={summary.kpis}
        chartTitle="Kardex por tipo"
        chartSubtitle="Entradas, salidas y ajustes"
        ariaLabel="Resumen de movimientos"
      >
        <MiniBars data={summary.bars} label="Movimientos por tipo" />
      </ModuleSummary>
    <TableCard
      header={(["Todos", "Entrada", "Salida", "Ajuste"] as const).map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => setFilter(f)}
          className={`px-4 h-10 rounded-full text-nav font-medium cursor-pointer ${
            filter === f ? "bg-primary text-white" : "text-ink-600 border border-ink-900/15"
          }`}
        >
          {f === "Todos" ? "Todos" : f === "Entrada" ? "Entradas" : f === "Salida" ? "Salidas" : "Ajustes"}
        </button>
      ))}
    >
      <THead>
        <tr>
          <TH>Fecha / Hora</TH>
          <TH>Tipo</TH>
          <TH>Insumo</TH>
          <TH>Cantidad</TH>
          <TH>Motivo</TH>
        </tr>
      </THead>
      <tbody>
        {rows.map((m) => (
          <TR key={m.id}>
            <TD tone="muted" nowrap>
              <span className="text-nav">{m.datetime}</span>
            </TD>
            <TD>
              <Badge tone={typeTone[m.type]} dot>
                {m.type}
              </Badge>
            </TD>
            <TD tone="strong">{m.ingredient}</TD>
            <TD tone="strong" nowrap className="tnum">
              {m.qty}
            </TD>
            <TD>{m.reason}</TD>
          </TR>
        ))}
      </tbody>
    </TableCard>
    </div>
  );
}
