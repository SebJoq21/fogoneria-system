"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/fields";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { Toolbar } from "@/components/ui/Toolbar";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { StaffModule } from "@/components/erp/StaffModule";
import { diaLima } from "@/lib/bi-api";
import {
  createShift,
  listEmployees,
  listShifts,
  removeShift,
  shiftBlockLabel,
  type ApiEmployee,
  type ApiShift,
  type ShiftBlock,
} from "@/lib/staff-api";

const bloqueTone: Record<ShiftBlock, "neutral" | "warning" | "dark"> = {
  MANANA: "neutral",
  TARDE: "warning",
  NOCHE: "dark",
};

/** Planificador de turnos: asignar y quitar por empleado, día y bloque (AYCDS-45). */
export function StaffTurnosView() {
  const { hasSession } = useModules();
  return hasSession ? <ShiftsLive /> : <StaffModule tab="turnos" />;
}

function ShiftsLive() {
  const { notify, activeBranchId } = useModules();
  const [fecha, setFecha] = useState(() => diaLima());
  const [turnos, setTurnos] = useState<ApiShift[]>([]);
  const [empleados, setEmpleados] = useState<ApiEmployee[]>([]);
  const [empleadoId, setEmpleadoId] = useState("");
  const [bloque, setBloque] = useState<ShiftBlock>("TARDE");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      setError(null);
      try {
        const [plan, personal] = await Promise.all([
          listShifts({
            fecha,
            ...(activeBranchId ? { sucursalId: activeBranchId } : {}),
            signal,
          }),
          listEmployees({ signal }),
        ]);
        setTurnos(plan);
        setEmpleados(personal);
        setEmpleadoId((actual) => actual || personal[0]?.id || "");
      } catch (problema) {
        if (signal?.aborted) return;
        setError(problema instanceof Error ? problema.message : "No se pudo cargar el plan.");
      }
    },
    [activeBranchId, fecha],
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

  const asignar = async () => {
    if (!empleadoId) return;
    try {
      await createShift({
        empleadoId,
        fecha,
        bloque,
        ...(activeBranchId ? { sucursalId: activeBranchId } : {}),
      });
      notify("Turno asignado", `${shiftBlockLabel(bloque)} del ${fecha}.`);
      await refresh();
    } catch (problema) {
      notify("No se pudo asignar", problema instanceof Error ? problema.message : "Reintenta.");
    }
  };

  const quitar = async (turno: ApiShift) => {
    try {
      await removeShift(turno.id);
      notify("Turno quitado", `${turno.empleados?.nombre ?? "Colaborador"} · ${shiftBlockLabel(turno.bloque)}.`);
      await refresh();
    } catch (problema) {
      notify("No se pudo quitar", problema instanceof Error ? problema.message : "Reintenta.");
    }
  };

  return (
    <div>
      <Toolbar
        left={
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Día">
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="h-10 rounded-full border border-ink-900/15 bg-white px-4 text-nav"
                aria-label="Día del plan"
              />
            </Field>
            <Field label="Colaborador">
              <Select value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)}>
                {empleados.map((empleado) => (
                  <option key={empleado.id} value={empleado.id}>
                    {empleado.nombre}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Bloque">
              <Select value={bloque} onChange={(e) => setBloque(e.target.value as ShiftBlock)}>
                <option value="MANANA">Mañana</option>
                <option value="TARDE">Tarde</option>
                <option value="NOCHE">Noche</option>
              </Select>
            </Field>
            <Button disabled={!empleadoId} onClick={() => void asignar()}>
              Asignar turno
            </Button>
          </div>
        }
        right={<p className="text-sm text-ink-400">{turnos.length} turnos planificados</p>}
      />

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <TableCard>
        <THead>
          <tr>
            <TH>Colaborador</TH>
            <TH>Bloque</TH>
            <TH right>Acción</TH>
          </tr>
        </THead>
        <tbody>
          {turnos.length === 0 ? (
            <TR>
              <TD tone="muted">Sin turnos para ese día.</TD>
              <TD>—</TD>
              <TD>—</TD>
            </TR>
          ) : (
            turnos.map((turno) => (
              <TR key={turno.id}>
                <TD tone="strong">{turno.empleados?.nombre ?? "—"}</TD>
                <TD>
                  <Badge tone={bloqueTone[turno.bloque]} dot>
                    {shiftBlockLabel(turno.bloque)}
                  </Badge>
                </TD>
                <TD right>
                  <button
                    type="button"
                    onClick={() => void quitar(turno)}
                    className="text-ink-400 hover:text-ink-900 font-medium text-nav cursor-pointer"
                  >
                    Quitar
                  </button>
                </TD>
              </TR>
            ))
          )}
        </tbody>
      </TableCard>
    </div>
  );
}
