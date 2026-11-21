'use client';

import { useCallback, useEffect, useState } from 'react';
import { diaLima } from '@fogoneria/kernel';
import type {
  Asistencia,
  BloqueTurno,
  Empleado,
  EstadoAsistencia,
  PozoPropina,
  Turno,
} from '@fogoneria/contracts/staff';
import { useModules } from '@/components/dashboard/ModulesProvider';
import { rrhhApi } from './api';

function mensaje(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** Asistencia del día + pozos de propinas del módulo RRHH. */
export function useAttendance() {
  const { activeBranchId, notify } = useModules();
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [pozos, setPozos] = useState<PozoPropina[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const [personal, marcas, propinas] = await Promise.all([
          rrhhApi.listEmpleados({ sucursalId: activeBranchId ?? undefined, signal }),
          rrhhApi.listAsistencias({ sucursalId: activeBranchId ?? undefined, signal }),
          rrhhApi.listPozos({ sucursalId: activeBranchId ?? undefined, signal }),
        ]);
        setEmpleados(personal);
        setAsistencias(marcas);
        setPozos(propinas);
      } catch (problema) {
        if (signal?.aborted) return;
        setError(mensaje(problema, 'No se pudo cargar RRHH.'));
      } finally {
        if (!signal?.aborted) setLoading(false);
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

  const marcar = useCallback(
    async (empleado: Empleado, estado: EstadoAsistencia) => {
      try {
        await rrhhApi.marcar({
          empleadoId: empleado.id,
          estado,
          ...(activeBranchId ? { sucursalId: activeBranchId } : {}),
        });
        notify('Asistencia marcada', `${empleado.nombre}: ${estado.toLowerCase()}.`);
        await refresh();
      } catch (problema) {
        notify('No se pudo marcar', mensaje(problema, 'Reintenta.'));
      }
    },
    [activeBranchId, notify, refresh],
  );

  const calcularPozo = useCallback(async () => {
    try {
      const pozo = await rrhhApi.calcularPozo({
        ...(activeBranchId ? { sucursalId: activeBranchId } : {}),
      });
      notify('Pozo calculado', `Total ${pozo.total} entre ${pozo.beneficiarios}.`);
      await refresh();
    } catch (problema) {
      notify('No se pudo calcular', mensaje(problema, 'Revisa las marcaciones.'));
    }
  }, [activeBranchId, notify, refresh]);

  const confirmarPozo = useCallback(
    async (pozo: PozoPropina) => {
      try {
        await rrhhApi.confirmarPozo(pozo.id);
        notify('Pozo repartido', `Fecha ${pozo.fecha.slice(0, 10)}.`);
        await refresh();
      } catch (problema) {
        notify('No se pudo confirmar', mensaje(problema, 'Reintenta.'));
      }
    },
    [notify, refresh],
  );

  return {
    empleados,
    asistencias,
    pozos,
    loading,
    error,
    refresh,
    marcar,
    calcularPozo,
    confirmarPozo,
  };
}

/** Plan de turnos por día, con asignación y baja. */
export function useShifts() {
  const { activeBranchId, notify } = useModules();
  const [fecha, setFecha] = useState(() => diaLima());
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const [plan, personal] = await Promise.all([
          rrhhApi.listTurnos({
            fecha,
            sucursalId: activeBranchId ?? undefined,
            signal,
          }),
          rrhhApi.listEmpleados({ sucursalId: activeBranchId ?? undefined, signal }),
        ]);
        setTurnos(plan);
        setEmpleados(personal);
      } catch (problema) {
        if (signal?.aborted) return;
        setError(mensaje(problema, 'No se pudo cargar el plan.'));
      } finally {
        if (!signal?.aborted) setLoading(false);
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

  const asignar = useCallback(
    async (empleadoId: string, bloque: BloqueTurno) => {
      try {
        await rrhhApi.crearTurno({
          empleadoId,
          fecha,
          bloque,
          ...(activeBranchId ? { sucursalId: activeBranchId } : {}),
        });
        notify('Turno asignado', `Bloque ${bloque.toLowerCase()} del ${fecha}.`);
        await refresh();
      } catch (problema) {
        notify('No se pudo asignar', mensaje(problema, 'Reintenta.'));
      }
    },
    [activeBranchId, fecha, notify, refresh],
  );

  const quitar = useCallback(
    async (turno: Turno) => {
      try {
        await rrhhApi.quitarTurno(turno.id);
        notify('Turno quitado', `${turno.empleado} · ${turno.bloque.toLowerCase()}.`);
        await refresh();
      } catch (problema) {
        notify('No se pudo quitar', mensaje(problema, 'Reintenta.'));
      }
    },
    [notify, refresh],
  );

  return { fecha, setFecha, empleados, turnos, loading, error, refresh, asignar, quitar };
}
