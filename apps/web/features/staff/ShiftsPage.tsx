'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/fields';
import { TableCard, THead, TH, TR, TD } from '@/components/ui/data-table';
import { Toolbar } from '@/components/ui/Toolbar';
import { useModules } from '@/components/dashboard/ModulesProvider';
import { etiquetaBloque, type BloqueTurno } from '@fogoneria/contracts/staff';
import { initialEmployees } from '@/lib/erp';
import { useShifts } from './hooks';

const tonoBloque: Record<BloqueTurno, 'neutral' | 'warning' | 'dark'> = {
  MANANA: 'neutral',
  TARDE: 'warning',
  NOCHE: 'dark',
};

/** Planificador de turnos del módulo RRHH. */
export function StaffShiftsPage() {
  const { hasSession } = useModules();
  return hasSession ? <ShiftsLive /> : <ShiftsDemo />;
}

function ShiftsLive() {
  const { fecha, setFecha, empleados, turnos, loading, error, asignar, quitar } = useShifts();
  const [empleadoId, setEmpleadoId] = useState('');
  const [bloque, setBloque] = useState<BloqueTurno>('TARDE');

  const seleccionado = empleadoId || empleados[0]?.id || '';

  return (
    <div>
      <Toolbar
        left={
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Día">
              <TextInput
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                aria-label="Día del plan"
                className="tnum"
              />
            </Field>
            <Field label="Colaborador">
              <Select value={seleccionado} onChange={(e) => setEmpleadoId(e.target.value)}>
                {empleados.map((empleado) => (
                  <option key={empleado.id} value={empleado.id}>
                    {empleado.nombre}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Bloque">
              <Select value={bloque} onChange={(e) => setBloque(e.target.value as BloqueTurno)}>
                <option value="MANANA">Mañana</option>
                <option value="TARDE">Tarde</option>
                <option value="NOCHE">Noche</option>
              </Select>
            </Field>
            <Button disabled={!seleccionado} onClick={() => void asignar(seleccionado, bloque)}>
              Asignar turno
            </Button>
          </div>
        }
        right={
          <p className="text-sm text-ink-400">
            {loading ? 'Cargando…' : `${turnos.length} turnos planificados`}
          </p>
        }
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
                <TD tone="strong">{turno.empleado || '—'}</TD>
                <TD>
                  <Badge tone={tonoBloque[turno.bloque]} dot>
                    {etiquetaBloque(turno.bloque)}
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

function ShiftsDemo() {
  const enTurno = initialEmployees.filter((empleado) => empleado.onShift);

  return (
    <div>
      <p className="mb-3 text-sm text-ink-400">Modo demo · sin sesión</p>
      <TableCard>
        <THead>
          <tr>
            <TH>Colaborador</TH>
            <TH>Rol</TH>
            <TH>Estado</TH>
          </tr>
        </THead>
        <tbody>
          {enTurno.map((empleado) => (
            <TR key={empleado.id}>
              <TD tone="strong">{empleado.name}</TD>
              <TD>{empleado.role}</TD>
              <TD>
                <Badge tone="success" dot>
                  En turno
                </Badge>
              </TD>
            </TR>
          ))}
        </tbody>
      </TableCard>
    </div>
  );
}
