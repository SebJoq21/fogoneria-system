"use client";

import { useMemo, useState } from "react";
import {
  initialAttendance,
  initialEmployees,
  initialShifts,
  weekDays,
} from "@/lib/erp";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";
import { personalSummary } from "@/components/erp/summaries/summary-selectors";

const roleTone: Record<string, string> = {
  Mozo: "bg-primary/[0.05] text-ink-600",
  Cocinero: "bg-primary/[0.05] text-ink-600",
  Barman: "bg-primary/[0.05] text-ink-600",
  Cajero: "bg-primary/[0.05] text-ink-600",
};

export function StaffModule({ tab = "equipo" }: { tab?: "equipo" | "turnos" | "propinas" }) {
  const { notify } = useModules();
  const [tipsPool] = useState(86.5);
  const [split, setSplit] = useState<number | null>(null);

  const onShift = initialEmployees.filter((e) => e.onShift);

  const calculateSplit = () => {
    if (onShift.length === 0) return;
    setSplit(tipsPool / onShift.length);
    notify(
      "Reparto calculado",
      `S/ ${tipsPool.toFixed(2)} entre ${onShift.length} personas activas: S/ ${(tipsPool / onShift.length).toFixed(2)} cada una.`,
    );
  };

  const summary = useMemo(() => {
    const marks = initialAttendance.length;
    const present = initialAttendance.filter((a) => a.present).length;
    return personalSummary(initialEmployees, present, marks);
  }, []);

  return (
    <div>
      <ModuleSummary
        kpis={summary.kpis}
        chartTitle={tab === "propinas" ? "Pozo vs equipo" : tab === "turnos" ? "Cobertura de turnos" : "Equipo en turno"}
        chartSubtitle="Primera vista de tu franquicia hoy"
        ariaLabel="Resumen de personal"
      >
        <MiniBars data={summary.bars} label="Personal en turno y en descanso" />
      </ModuleSummary>
      {tab === "equipo" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialEmployees.map((e) => (
            <Card key={e.id} className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-nav font-medium shrink-0">
                {e.initials}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-900 truncate">{e.name}</p>
                <p className="text-xs text-ink-400">{e.role}</p>
              </div>
              <Badge tone={e.onShift ? "success" : "neutral"} dot>
                {e.onShift ? "En turno" : "Descanso"}
              </Badge>
            </Card>
          ))}
        </div>
      )}

      {tab === "turnos" && (
        <TableCard
          footer={
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5 text-xs text-ink-600">
                <span className="px-2 py-0.5 rounded-full bg-primary text-white text-xs">Mañana</span>
                Turno mañana
              </span>
              <span className="flex items-center gap-1.5 text-xs text-ink-600">
                <span className="px-2 py-0.5 rounded-full bg-primary/15 text-ink-900 text-xs">Tarde</span>
                Turno tarde
              </span>
            </div>
          }
        >
          <THead>
            <tr>
              <TH className="sticky left-0 bg-surface">
                Trabajador
              </TH>
              {weekDays.map((d) => (
                <TH key={d} className="px-2 text-center min-w-16">
                  {d}
                </TH>
              ))}
            </tr>
          </THead>
          <tbody>
            {initialEmployees.map((e) => (
              <TR key={e.id}>
                <TD tone="strong" className="sticky left-0 bg-surface whitespace-nowrap py-2.5">
                  {e.name}
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-md ${roleTone[e.role]}`}>
                    {e.role}
                  </span>
                </TD>
                {weekDays.map((_, day) => {
                  const block = initialShifts.find(
                    (s) => s.employeeId === e.id && s.day === day,
                  );
                  return (
                    <TD key={day} className="px-2 py-2.5 text-center">
                      {block ? (
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                            block.shift === "M"
                              ? "bg-primary text-white"
                              : "bg-primary/15 text-ink-900"
                          }`}
                        >
                          {block.shift === "M" ? "Mañana" : "Tarde"}
                        </span>
                      ) : (
                        <span className="text-ink-400">·</span>
                      )}
                    </TD>
                  );
                })}
              </TR>
            ))}
          </tbody>
        </TableCard>
      )}

      {tab === "propinas" && (
        <Card className="max-w-md mx-auto text-center">
          <p className="text-xs font-medium uppercase text-ink-400 mb-2">
            Pozo total de hoy
          </p>
          <p className="text-display font-medium text-ink-900 mb-1">
            S/ {tipsPool.toFixed(2)}
          </p>
          <p className="text-nav text-ink-400 mb-6">
            {onShift.length} personas activas en turno
          </p>
          <Button
            onClick={calculateSplit}
            className="w-full"
          >
            Calcular reparto equitativo
          </Button>
          {split !== null && (
            <div className="mt-6 pt-4 border-t border-ink-900/[0.06]">
              <p className="text-sm text-ink-600">
                Cada persona recibe{" "}
                <strong className="text-ink-900">S/ {split.toFixed(2)}</strong>
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
