"use client";

import { useMemo } from "react";
import { initialAttendance, initialEmployees, weekDays } from "@/lib/erp";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";
import { personalSummary } from "@/components/erp/summaries/summary-selectors";

/** Trabajadores · Asistencia: control semanal de presentes por colaborador. */
export function StaffAttendanceView() {
  const present = (employeeId: number, day: number) =>
    initialAttendance.some((a) => a.employeeId === employeeId && a.day === day && a.present);

  const rate = (employeeId: number) => {
    const marks = initialAttendance.filter((a) => a.employeeId === employeeId);
    if (marks.length === 0) return "—";
    const pct = Math.round((marks.filter((m) => m.present).length / marks.length) * 100);
    return `${pct}%`;
  };

  const summary = useMemo(() => {
    const present = initialAttendance.filter((a) => a.present).length;
    return personalSummary(initialEmployees, present, initialAttendance.length);
  }, []);

  return (
    <div>
      <ModuleSummary
        kpis={summary.kpis}
        chartTitle="Asistencia semanal"
        chartSubtitle="Presentes sobre turnos marcados"
        ariaLabel="Resumen de asistencia"
      >
        <MiniBars
          data={weekDays.slice(0, 5).map((d, day) => ({
            name: d,
            v: initialAttendance.filter((a) => a.day === day && a.present).length,
          }))}
          label="Presentes por día"
        />
      </ModuleSummary>
    <TableCard>
      <THead>
        <tr>
          <TH>Colaborador</TH>
          {weekDays.slice(0, 5).map((d) => (
            <TH key={d}>{d}</TH>
          ))}
          <TH right>Asistencia</TH>
        </tr>
      </THead>
      <tbody>
        {initialEmployees.map((e) => (
          <TR key={e.id}>
            <TD tone="strong" nowrap>
              {e.name}
              <span className="ml-2 text-xs font-medium text-ink-400">{e.role}</span>
            </TD>
            {weekDays.slice(0, 5).map((_, day) =>
              present(e.id, day) ? (
                <TD key={day}>
                  <span className="inline-flex w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200 items-center justify-center">
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="text-emerald-600">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                </TD>
              ) : (
                <TD key={day} tone="muted">
                  —
                </TD>
              ),
            )}
            <TD tone="strong" right className="tnum">
              {rate(e.id)}
            </TD>
          </TR>
        ))}
      </tbody>
    </TableCard>
    </div>
  );
}
