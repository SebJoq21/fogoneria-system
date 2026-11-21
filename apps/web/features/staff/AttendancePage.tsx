'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TableCard, THead, TH, TR, TD } from '@/components/ui/data-table';
import { useModules } from '@/components/dashboard/ModulesProvider';
import {
  etiquetaAsistencia,
  type Asistencia,
  type EstadoAsistencia,
  type PozoPropina,
} from '@fogoneria/contracts/staff';
import { useAttendance } from './hooks';
import { AttendanceDemo } from './attendance-demo';

const tonoEstado: Record<EstadoAsistencia, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PRESENTE: 'success',
  TARDANZA: 'warning',
  FALTA: 'danger',
  DESCANSO: 'neutral',
};

function hora(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

/** Pantalla de asistencia y propinas del módulo RRHH. */
export function StaffAttendancePage() {
  const { hasSession } = useModules();
  return hasSession ? <AttendanceLive /> : <AttendanceDemo />;
}

function AttendanceLive() {
  const { empleados, asistencias, pozos, loading, error, marcar, calcularPozo, confirmarPozo } =
    useAttendance();

  const porEmpleado = useMemo(() => {
    const mapa = new Map<string, Asistencia>();
    for (const marca of asistencias) mapa.set(marca.empleadoId, marca);
    return mapa;
  }, [asistencias]);

  const presentes = asistencias.filter((a) => a.estado === 'PRESENTE').length;
  const tardanzas = asistencias.filter((a) => a.estado === 'TARDANZA').length;
  const faltas = asistencias.filter((a) => a.estado === 'FALTA').length;

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
          <p className="text-display font-medium tnum">{pozos[0] ? pozos[0].total.toFixed(2) : '—'}</p>
          <p className="text-xs text-ink-400">
            {pozos[0]
              ? `${pozos[0].beneficiarios} beneficiarios · ${pozos[0].estado.toLowerCase()}`
              : 'sin calcular'}
          </p>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <TableCard
        header={
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink-400">
              {loading ? 'Cargando…' : `${empleados.length} colaboradores activos · marcación de hoy`}
            </p>
            <Button variant="secondary" onClick={() => void calcularPozo()}>
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
                  <span className="ml-2 text-xs font-medium text-ink-400">{empleado.rol ?? '—'}</span>
                </TD>
                <TD>
                  {marca ? (
                    <Badge tone={tonoEstado[marca.estado]} dot>
                      {etiquetaAsistencia(marca.estado)}
                    </Badge>
                  ) : (
                    <span className="text-nav text-ink-400">Sin marcar</span>
                  )}
                </TD>
                <TD tone="muted" nowrap>
                  {hora(marca?.horaEntrada ?? null)}
                </TD>
                <TD tone="muted" nowrap>
                  {hora(marca?.horaSalida ?? null)}
                </TD>
                <TD right nowrap>
                  <span className="flex items-center gap-2 justify-end">
                    <Accion onClick={() => void marcar(empleado, 'PRESENTE')}>Presente</Accion>
                    <Accion onClick={() => void marcar(empleado, 'TARDANZA')}>Tardanza</Accion>
                    <Accion onClick={() => void marcar(empleado, 'FALTA')}>Falta</Accion>
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
              pozos.slice(0, 5).map((pozo: PozoPropina) => (
                <TR key={pozo.id}>
                  <TD nowrap>{pozo.fecha.slice(0, 10)}</TD>
                  <TD right className="tnum">
                    {pozo.total.toFixed(2)}
                  </TD>
                  <TD right className="tnum">
                    {pozo.beneficiarios}
                  </TD>
                  <TD>
                    <Badge tone={pozo.estado === 'REPARTIDO' ? 'success' : 'neutral'} dot>
                      {pozo.estado === 'REPARTIDO' ? 'Repartido' : 'Calculado'}
                    </Badge>
                  </TD>
                  <TD right>
                    {pozo.estado === 'CALCULADO' ? (
                      <Accion onClick={() => void confirmarPozo(pozo)}>Confirmar</Accion>
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
  tone: 'success' | 'warning' | 'danger';
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
