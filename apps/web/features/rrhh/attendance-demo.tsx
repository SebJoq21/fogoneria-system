'use client';

import { initialAttendance, initialEmployees, weekDays } from '@/lib/erp';
import { TableCard, THead, TH, TR, TD } from '@/components/ui/data-table';

/**
 * Vista de demostración (sin sesión): matriz semanal con los datos del ERP demo.
 * Vive dentro de la feature para no acoplarse a `components/erp`.
 */
export function AttendanceDemo() {
  const presente = (empleadoId: number, dia: number) =>
    initialAttendance.some((a) => a.employeeId === empleadoId && a.day === dia && a.present);

  const tasa = (empleadoId: number) => {
    const marcas = initialAttendance.filter((a) => a.employeeId === empleadoId);
    if (marcas.length === 0) return '—';
    const porcentaje = Math.round((marcas.filter((m) => m.present).length / marcas.length) * 100);
    return `${porcentaje}%`;
  };

  return (
    <div>
      <p className="mb-3 text-sm text-ink-400">Modo demo · sin sesión</p>
      <TableCard>
        <THead>
          <tr>
            <TH>Colaborador</TH>
            {weekDays.slice(0, 5).map((dia) => (
              <TH key={dia}>{dia}</TH>
            ))}
            <TH right>Asistencia</TH>
          </tr>
        </THead>
        <tbody>
          {initialEmployees.map((empleado) => (
            <TR key={empleado.id}>
              <TD tone="strong" nowrap>
                {empleado.name}
                <span className="ml-2 text-xs font-medium text-ink-400">{empleado.role}</span>
              </TD>
              {weekDays.slice(0, 5).map((_, dia) =>
                presente(empleado.id, dia) ? (
                  <TD key={dia}>
                    <span className="inline-flex w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200 items-center justify-center">
                      <svg
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        className="text-emerald-600"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  </TD>
                ) : (
                  <TD key={dia} tone="muted">
                    —
                  </TD>
                ),
              )}
              <TD tone="strong" right className="tnum">
                {tasa(empleado.id)}
              </TD>
            </TR>
          ))}
        </tbody>
      </TableCard>
    </div>
  );
}
