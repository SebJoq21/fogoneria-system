"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";
import { kardexSummary } from "@/components/erp/summaries/summary-selectors";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { fmtDateTime } from "@/lib/domain";
import type { StockMovement } from "@/lib/erp";
import {
  getStockStatus,
  listMovements,
  movementQtyLabel,
  movementTypeLabel,
} from "@/lib/inventory-api";

const typeTone = { Entrada: "success", Salida: "neutral", Ajuste: "warning" } as const;

/** Inventarios · Movimientos: kardex de entradas, salidas y ajustes. */
export function InventoryMovementsView() {
  const { hasSession, movements } = useModules();
  const [filter, setFilter] = useState<"Todos" | "Entrada" | "Salida" | "Ajuste">(() => {
    try {
      if (typeof window === "undefined") return "Todos";
      const t = new URLSearchParams(window.location.search).get("tipo");
      return t === "Entrada" || t === "Salida" || t === "Ajuste" ? t : "Todos";
    } catch {
      return "Todos";
    }
  });

  const [apiRows, setApiRows] = useState<StockMovement[]>([]);
  const [semaforo, setSemaforo] = useState<{ agotados: number; bajos: number; optimos: number } | null>(
    null,
  );
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSession) return;
    const controller = new AbortController();
    // Diferido al siguiente tick: el efecto no debe disparar renders en cascada.
    const timer = setTimeout(() => {
      Promise.all([
        listMovements({ limit: 200, signal: controller.signal }),
        getStockStatus({ signal: controller.signal }),
      ])
        .then(([kardex, stock]) => {
          setSemaforo({
            agotados: stock.resumen.agotados,
            bajos: stock.resumen.bajos,
            optimos: stock.resumen.optimos,
          });
          setApiRows(
            kardex.items.map((movimiento, indice) => {
              const etiqueta = movementTypeLabel(movimiento.tipo);
              return {
                id: indice + 1,
                datetime: fmtDateTime(movimiento.fecha),
                type: etiqueta === "Merma" ? "Ajuste" : etiqueta,
                ingredient: movimiento.insumo,
                qty: movementQtyLabel(movimiento),
                reason:
                  movimiento.motivo ??
                  (movimiento.orden ? `Comanda ${movimiento.orden}` : "Sin motivo"),
              };
            }),
          );
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setApiError(
            error instanceof Error ? error.message : "No se pudo cargar el kardex.",
          );
        });
    }, 0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [hasSession]);

  const base = hasSession ? apiRows : movements;
  const rows = filter === "Todos" ? base : base.filter((m) => m.type === filter);

  const summary = useMemo(() => kardexSummary(base), [base]);

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
    {semaforo && (
      <p className="mb-3 text-sm text-ink-400">
        Semáforo: <strong className="text-ink-900">{semaforo.agotados}</strong> agotados ·{" "}
        <strong className="text-ink-900">{semaforo.bajos}</strong> bajos · {semaforo.optimos} óptimos
        {apiError ? ` · ${apiError}` : ""}
      </p>
    )}
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
