// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  listEmpleados: vi.fn(),
  listAsistencias: vi.fn(),
  listPozos: vi.fn(),
  listTurnos: vi.fn(),
  marcar: vi.fn(),
  crearTurno: vi.fn(),
  quitarTurno: vi.fn(),
  calcularPozo: vi.fn(),
  confirmarPozo: vi.fn(),
}));

const entorno = vi.hoisted(() => ({
  activeBranchId: 's-1' as string | null,
  notify: vi.fn(),
}));

vi.mock('./api', () => ({ rrhhApi: api }));
vi.mock('@/components/dashboard/ModulesProvider', () => ({
  useModules: () => ({ activeBranchId: entorno.activeBranchId, notify: entorno.notify }),
}));

import { useAttendance, useShifts } from './hooks';

const empleado = { id: 'e-1', nombre: 'Ana', sucursalId: 's-1', activo: true, rol: 'Mesero' };
const asistencia = {
  id: 'a-1',
  empleadoId: 'e-1',
  empleado: 'Ana',
  fecha: '2026-11-20',
  estado: 'PRESENTE' as const,
  horaEntrada: null,
  horaSalida: null,
  fuente: null,
};
const pozo = { id: 'p-1', fecha: '2026-11-20', total: 100, beneficiarios: 2, estado: 'CALCULADO' as const };

describe('useAttendance', () => {
  beforeEach(() => {
    entorno.activeBranchId = 's-1';
    entorno.notify.mockReset();
    for (const fn of Object.values(api)) fn.mockReset();
    api.listEmpleados.mockResolvedValue([empleado]);
    api.listAsistencias.mockResolvedValue([asistencia]);
    api.listPozos.mockResolvedValue([pozo]);
    api.marcar.mockResolvedValue(asistencia);
    api.calcularPozo.mockResolvedValue(pozo);
    api.confirmarPozo.mockResolvedValue({ ...pozo, estado: 'REPARTIDO' });
  });

  it('carga personal, marcaciones y pozos de la sucursal', async () => {
    const { result } = renderHook(() => useAttendance());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.empleados).toHaveLength(1);
    expect(result.current.asistencias).toHaveLength(1);
    expect(result.current.pozos).toHaveLength(1);
    expect(api.listEmpleados).toHaveBeenCalledWith({ sucursalId: 's-1', signal: expect.any(AbortSignal) });
  });

  it('sin sucursal consulta el agregado', async () => {
    entorno.activeBranchId = null;
    const { result } = renderHook(() => useAttendance());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(api.listEmpleados).toHaveBeenCalledWith({ sucursalId: undefined, signal: expect.any(AbortSignal) });
  });

  it('expone el error de carga', async () => {
    api.listEmpleados.mockRejectedValue(new Error('RRHH caído'));
    const { result } = renderHook(() => useAttendance());
    await waitFor(() => expect(result.current.error).toBe('RRHH caído'));
    expect(result.current.loading).toBe(false);
  });

  it('marca asistencia y notifica el resultado', async () => {
    const { result } = renderHook(() => useAttendance());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.marcar(empleado, 'TARDANZA');
    });
    expect(api.marcar).toHaveBeenCalledWith(expect.objectContaining({ empleadoId: 'e-1', estado: 'TARDANZA' }));
    expect(entorno.notify).toHaveBeenCalledWith('Asistencia marcada', expect.stringContaining('Ana'));
  });

  it('un fallo al marcar notifica sin romper', async () => {
    api.marcar.mockRejectedValue('sin red');
    const { result } = renderHook(() => useAttendance());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.marcar(empleado, 'FALTA');
    });
    expect(entorno.notify).toHaveBeenCalledWith('No se pudo marcar', 'Reintenta.');
  });

  it('calcula y confirma el pozo', async () => {
    const { result } = renderHook(() => useAttendance());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.calcularPozo();
    });
    expect(entorno.notify).toHaveBeenCalledWith('Pozo calculado', expect.stringContaining('100'));

    await act(async () => {
      await result.current.confirmarPozo(pozo);
    });
    expect(entorno.notify).toHaveBeenCalledWith('Pozo repartido', expect.stringContaining('2026-11-20'));
  });

  it('errores de pozo se notifican', async () => {
    api.calcularPozo.mockRejectedValue(new Error('sin marcaciones'));
    api.confirmarPozo.mockRejectedValue('x');
    const { result } = renderHook(() => useAttendance());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.calcularPozo();
    });
    expect(entorno.notify).toHaveBeenCalledWith('No se pudo calcular', 'sin marcaciones');

    await act(async () => {
      await result.current.confirmarPozo(pozo);
    });
    expect(entorno.notify).toHaveBeenCalledWith('No se pudo confirmar', 'Reintenta.');
  });
});

describe('useShifts', () => {
  beforeEach(() => {
    entorno.activeBranchId = 's-1';
    entorno.notify.mockReset();
    for (const fn of Object.values(api)) fn.mockReset();
    api.listTurnos.mockResolvedValue([
      { id: 't-1', empleadoId: 'e-1', empleado: 'Ana', fecha: '2026-11-20', bloque: 'TARDE' },
    ]);
    api.listEmpleados.mockResolvedValue([empleado]);
    api.crearTurno.mockResolvedValue({ id: 't-2' });
    api.quitarTurno.mockResolvedValue(undefined);
  });

  it('carga el plan del día y los empleados', async () => {
    const { result } = renderHook(() => useShifts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.turnos).toHaveLength(1);
    expect(result.current.empleados).toHaveLength(1);
  });

  it('expone el error de carga del plan', async () => {
    api.listTurnos.mockRejectedValue(new Error('plan caído'));
    const { result } = renderHook(() => useShifts());
    await waitFor(() => expect(result.current.error).toBe('plan caído'));
  });

  it('asigna y quita turnos con notificación', async () => {
    const { result } = renderHook(() => useShifts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.asignar('e-1', 'NOCHE');
    });
    expect(api.crearTurno).toHaveBeenCalledWith(
      expect.objectContaining({ empleadoId: 'e-1', bloque: 'NOCHE', sucursalId: 's-1' }),
    );
    expect(entorno.notify).toHaveBeenCalledWith('Turno asignado', expect.stringContaining('noche'));

    await act(async () => {
      await result.current.quitar(result.current.turnos[0]);
    });
    expect(api.quitarTurno).toHaveBeenCalledWith('t-1');
    expect(entorno.notify).toHaveBeenCalledWith('Turno quitado', expect.stringContaining('Ana'));
  });

  it('errores de asignación y baja se notifican', async () => {
    api.crearTurno.mockRejectedValue(new Error('duplicado'));
    api.quitarTurno.mockRejectedValue('x');
    const { result } = renderHook(() => useShifts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.asignar('e-1', 'TARDE');
    });
    expect(entorno.notify).toHaveBeenCalledWith('No se pudo asignar', 'duplicado');

    await act(async () => {
      await result.current.quitar(result.current.turnos[0]);
    });
    expect(entorno.notify).toHaveBeenCalledWith('No se pudo quitar', 'Reintenta.');
  });
});
