"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";
import { personalSummary } from "@/components/erp/summaries/summary-selectors";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { initialAttendance, initialEmployees, weekDays } from "@/lib/erp";
import {
  attendanceLabel,
  calculateTips,
  confirmTip,
  listAttendance,
  listEmployees,
  listTips,
  markAttendance,
  type ApiAttendance,
  type ApiAttendanceState,
  type ApiEmployee,
  type ApiTipPool,
} from "@/lib/staff-api";

const estadoTone: Record<ApiAttendanceState, "success" | "warning" | "danger" | "neutral"> = {
  PRESENTE: "success",
  TARDANZA: "warning",
  FALTA: "danger",
  DESCANSO: "neutral",
};

/** Personal → Asistencia: marcación del día y pozo de propinas (AYCDS-45). */
export function StaffAttendanceView() {
  const { hasSession } = useModules();
  return hasSession ? <AttendanceLive /> : <AttendanceDemo />;
}

/* --------------------------------- API real -------------------------------- */

function AttendanceLive() {
  const { notify, activeBranchId } = useModules();
  const [empleados, setEmpleados] = useState<ApiEmployee[]>([]);
  const [asistencias, setAsistencias] = useState<ApiAttendance[]>([]);
  const [pozos, setPozos] = useState<ApiTipPool[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      setError(null);
      try {
        const [personal, marcas, propinas] = await Promise.all([
          listEmployees({ signal }),
          listAttendance({ ...(activeBranchId ? { sucursalId: activeBranchId } : {}), signal }),
          listTips({ ...(activeBranchId ? { sucursalId: activeBranchId } : {}), signal }),
        ]);
        setEmpleados(personal);
        setAsistencias(marcas);
        setPozos(propinas);
      } catch (problema) {
        if (signal?.aborted) return;
        setError(problema instanceof Error ? problema.message : "No se pudo cargar RRHH.");
      }
    },
    [activeBranchId],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void refresh(controller.signal);
    }, 0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [refresh]);

  const porEmpleado = useMemo(() => {
    const mapa = new Map<string, ApiAttendance>();
    for (const marca of asistencias) mapa.set(marca.empleado_id, marca);
    return mapa;
  }, [asistencias]);

  const presentes = asistencias.filter((a) => a.estado === "PRESENTE").length;
  const tardanzas = asistencias.filter((a) => a.estado === "TARDANZA").length;
  const faltas = asistencias.filter((a) => a.estado === "FALTA").length;

  const marcar = async (empleado: ApiEmployee, estado: ApiAttendanceState) => {
    try {
      await markAttendance({
        empleadoId: empleado.id,
        estado,
        ...(activeBranchId ? { sucursalId: activeBranchId } : {}),
      });
      notify("Asistencia marcada", `${empleado.nombre}: ${attendanceLabel(estado)}.`);
      await refresh();
    } catch (problema) {
      notify("No se pudo marcar", problema instanceof Error ? problema.message : "Reintenta.");
    }
  };

  const calcular = async () => {
    try {
      const pozo = await calculateTips(activeBranchId ? { sucursalId: activeBranchId } : {});
      notify("Pozo calculado", `Total ${pozo.total} entre ${pozo.nro_beneficiarios}.`);
      await refresh();
    } catch (problema) {
      notify("No se pudo calcular", problema instanceof Error ? problema.message : "Revisa las marcaciones.");
    }
  };

  const confirmar = async (pozo: ApiTipPool) => {
    try {
      await confirmTip(pozo.id);
      notify("Pozo repartido", `Fecha ${pozo.fecha.slice(0, 10)}.`);
      await refresh();
    } catch (problema) {
      notify("No se pudo confirmar", problema instanceof Error ? problema.message : "Reintenta.");
    }
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
        <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCelda label="Presentes" value={presentes} tone="success" />
          <KpiCelda label="Tardanzas" value={tardanzas} tone="warning" />
          <KpiCelda label="Faltas" value={faltas} tone="danger" />
        </div>
        <div className="rounded-2xl border border-ink-900/10 p-4">
          <p className="text-xs text-ink-400">Pozo de propinas</p>
          <p className="text-display font-medium tnum">
            {pozos[0] ? Number(pozos[0].total).toFixed(2) : "—"}
          </p>
          <p className="text-xs text-ink-400">
            {pozos[0] ? `${pozos[0].nro_beneficiarios} beneficiarios · ${pozos[0].estado}` : "sin calcular"}
          </p>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <TableCard
        header={
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink-400">{empleados.length} colaboradores activos · marcación de hoy</p>
            <Button variant="secondary" onClick={() => void calcular()}>
              Calcular pozo de hoy
            </Button>
          </div>
        }
      >
        <THead>
          <tr>
            <TH>Colaborador</TH>
            <TH>Estado</TH>
            <TH>Entrada</TH>
            <TH>Salida</TH>
            <TH right>Marcar</TH>
          </tr>
        </THead>
        <tbody>
          {empleados.map((empleado) => {
            const marca = porEmpleado.get(empleado.id);
            return (
              <TR key={empleado.id}>
                <TD tone="strong" nowrap>
                  {empleado.nombre}
                  <span className="ml-2 text-xs font-medium text-ink-400">
                    {empleado.roles_empresa?.nombre ?? "—"}
                  </span>
                </TD>
                <TD>
                  {marca ? (
                    <Badge tone={estadoTone[marca.estado]} dot>
                      {attendanceLabel(marca.estado)}
                    </Badge>
                  ) : (
                    <span className="text-nav text-ink-400">Sin marcar</span>
                  )}
                </TD>
                <TD tone="muted" nowrap>
                  {marca?.hora_entrada ? hora(marca.hora_entrada) : "—"}
                </TD>
                <TD tone="muted" nowrap>
                  {marca?.hora_salida ? hora(marca.hora_salida) : "—"}
                </TD>
                <TD right nowrap>
                  <span className="flex items-center gap-2 justify-end">
                    <Accion onClick={() => void marcar(empleado, "PRESENTE")}>Presente</Accion>
                    <Accion onClick={() => void marcar(empleado, "TARDANZA")}>Tardanza</Accion>
                    <Accion onClick={() => void marcar(empleado, "FALTA")}>Falta</Accion>
                  </span>
                </TD>
              </TR>
            );
          })}
        </tbody>
      </TableCard>

      <div className="mt-6">
        <h3 className="text-sm font-medium text-ink-900 mb-3">Últimos pozos de propinas</h3>
        <TableCard>
          <THead>
            <tr>
              <TH>Fecha</TH>
              <TH right>Total</TH>
              <TH right>Beneficiarios</TH>
              <TH>Estado</TH>
              <TH right>Acción</TH>
            </tr>
          </THead>
          <tbody>
            {pozos.length === 0 ? (
              <TR>
                <TD tone="muted">Sin pozos calculados.</TD>
                <TD>—</TD>
                <TD>—</TD>
                <TD>—</TD>
                <TD>—</TD>
              </TR>
            ) : (
              pozos.slice(0, 5).map((pozo) => (
                <TR key={pozo.id}>
                  <TD nowrap>{pozo.fecha.slice(0, 10)}</TD>
                  <TD right className="tnum">{Number(pozo.total).toFixed(2)}</TD>
                  <TD right className="tnum">{pozo.nro_beneficiarios}</TD>
                  <TD>
                    <Badge tone={pozo.estado === "REPARTIDO" ? "success" : "neutral"} dot>
                      {pozo.estado === "REPARTIDO" ? "Repartido" : "Calculado"}
                    </Badge>
                  </TD>
                  <TD right>
                    {pozo.estado === "CALCULADO" ? (
                      <Accion onClick={() => void confirmar(pozo)}>Confirmar</Accion>
                    ) : (
                      <span className="text-nav text-ink-400">—</span>
                    )}
                  </TD>
                </TR>
              ))
            )}
          </tbody>
        </TableCard>
      </div>
    </div>
  );
}

function KpiCelda({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "danger";
}) {
  return (
    <div className="rounded-2xl border border-ink-900/10 p-4">
      <p className="text-xs text-ink-400">{label}</p>
      <p className="text-display font-medium tnum">{value}</p>
      <Badge tone={tone} dot>
        hoy
      </Badge>
    </div>
  );
}

function Accion({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-ink-400 hover:text-ink-900 font-medium text-nav cursor-pointer"
    >
      {children}
    </button>
  );
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

/* ----------------------------------- demo ---------------------------------- */

function AttendanceDemo() {
  const present = (employeeId: number, day: number) =>
    initialAttendance.some((a) => a.employeeId === employeeId && a.day === day && a.present);

  const rate = (employeeId: number) => {
    const marks = initialAttendance.filter((a) => a.employeeId === employeeId);
    if (marks.length === 0) return "—";
    const pct = Math.round((marks.filter((m) => m.present).length / marks.length) * 100);
    return `${pct}%`;
  };

  const summary = useMemo(() => {
    const presentes = initialAttendance.filter((a) => a.present).length;
    return personalSummary(initialEmployees, presentes, initialAttendance.length);
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
