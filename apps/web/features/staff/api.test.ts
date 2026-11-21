import { beforeEach, describe, expect, it, vi } from 'vitest';

const cliente = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  request: vi.fn(),
}));

vi.mock('@fogoneria/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fogoneria/sdk')>();
  return { ...actual, createClient: () => cliente };
});

import { rrhhApi, toAsistencia, toEmpleado, toPozo, toTurno } from './api';

const rawEmpleado = {
  id: 'e-1',
  nombre: 'Ana',
  sucursal_id: 's-1',
  activo: true,
  roles_empresa: { nombre: 'Mesero' },
};

const rawAsistencia = {
  id: 'a-1',
  empleado_id: 'e-1',
  fecha: '2026-11-20',
  estado: 'PRESENTE' as const,
  hora_entrada: '09:00',
  hora_salida: null,
  fuente: 'manual',
  empleados: { id: 'e-1', nombre: 'Ana' },
};

const rawTurno = {
  id: 't-1',
  fecha: '2026-11-20',
  bloque: 'TARDE' as const,
  empleados: { id: 'e-1', nombre: 'Ana' },
};

const rawPozo = {
  id: 'p-1',
  fecha: '2026-11-20',
  total: '105.00',
  nro_beneficiarios: 2,
  estado: 'CALCULADO' as const,
};

beforeEach(() => {
  for (const fn of Object.values(cliente)) fn.mockReset();
});

describe('mapeos de RRHH', () => {
  it('traduce el empleado con su rol', () => {
    expect(toEmpleado(rawEmpleado)).toEqual({
      id: 'e-1',
      nombre: 'Ana',
      sucursalId: 's-1',
      activo: true,
      rol: 'Mesero',
    });
    expect(toEmpleado({ ...rawEmpleado, roles_empresa: null }).rol).toBeNull();
  });

  it('traduce asistencia, turno y pozo', () => {
    expect(toAsistencia(rawAsistencia)).toMatchObject({
      empleadoId: 'e-1',
      empleado: 'Ana',
      estado: 'PRESENTE',
    });
    expect(toAsistencia({ ...rawAsistencia, empleados: null }).empleado).toBe('');
    expect(toTurno(rawTurno)).toEqual({
      id: 't-1',
      empleadoId: 'e-1',
      empleado: 'Ana',
      fecha: '2026-11-20',
      bloque: 'TARDE',
    });
    expect(toTurno({ ...rawTurno, empleados: null })).toMatchObject({
      empleadoId: '',
      empleado: '',
    });
    expect(toPozo(rawPozo)).toEqual({
      id: 'p-1',
      fecha: '2026-11-20',
      total: 105,
      beneficiarios: 2,
      estado: 'CALCULADO',
    });
    expect(toPozo({ ...rawPozo, total: null as unknown as string }).total).toBe(0);
  });
});

describe('rrhhApi colaboradores', () => {
  it('lista empleados con filtros', async () => {
    cliente.get.mockResolvedValue([rawEmpleado]);
    const empleados = await rrhhApi.listEmpleados({ sucursalId: 's-1', activo: true });
    expect(cliente.get).toHaveBeenCalledWith('/staff/employees?sucursalId=s-1&activo=true', {
      signal: undefined,
    });
    expect(empleados[0].rol).toBe('Mesero');

    await rrhhApi.listEmpleados({ activo: false });
    expect(cliente.get).toHaveBeenLastCalledWith('/staff/employees?activo=false', {
      signal: undefined,
    });
    await rrhhApi.listEmpleados();
    expect(cliente.get).toHaveBeenLastCalledWith('/staff/employees', { signal: undefined });
  });

  it('lista asistencias y turnos por fecha', async () => {
    cliente.get.mockResolvedValue([rawAsistencia]);
    await rrhhApi.listAsistencias({ sucursalId: 's-1', fecha: '2026-11-20' });
    expect(cliente.get).toHaveBeenCalledWith(
      '/staff/attendance?sucursalId=s-1&fecha=2026-11-20',
      { signal: undefined },
    );
    cliente.get.mockResolvedValue([rawTurno]);
    await rrhhApi.listTurnos({ fecha: '2026-11-20' });
    expect(cliente.get).toHaveBeenLastCalledWith('/staff/shifts?fecha=2026-11-20', {
      signal: undefined,
    });
  });

  it('marca asistencia con el input del contrato', async () => {
    cliente.post.mockResolvedValue(rawAsistencia);
    const asistencia = await rrhhApi.marcar({
      empleadoId: 'e-1',
      estado: 'TARDANZA',
      horaEntrada: '09:15',
    });
    expect(cliente.post).toHaveBeenCalledWith('/staff/attendance', {
      empleadoId: 'e-1',
      estado: 'TARDANZA',
      horaEntrada: '09:15',
    });
    expect(asistencia.estado).toBe('PRESENTE');
  });

  it('crea y quita turnos', async () => {
    cliente.post.mockResolvedValue(rawTurno);
    await rrhhApi.crearTurno({ empleadoId: 'e-1', fecha: '2026-11-20', bloque: 'NOCHE' });
    expect(cliente.post).toHaveBeenCalledWith('/staff/shifts', {
      empleadoId: 'e-1',
      fecha: '2026-11-20',
      bloque: 'NOCHE',
    });
    cliente.delete.mockResolvedValue({ id: 't-1' });
    await rrhhApi.quitarTurno('t-1');
    expect(cliente.delete).toHaveBeenCalledWith('/staff/shifts/t-1');
  });
});

describe('rrhhApi propinas', () => {
  it('lista, calcula y confirma el pozo', async () => {
    cliente.get.mockResolvedValue([rawPozo]);
    const pozos = await rrhhApi.listPozos({ sucursalId: 's-1' });
    expect(cliente.get).toHaveBeenCalledWith('/staff/tips?sucursalId=s-1', {
      signal: undefined,
    });
    expect(pozos[0].total).toBe(105);

    cliente.post.mockResolvedValue(rawPozo);
    await rrhhApi.calcularPozo({ sucursalId: 's-1', fecha: '2026-11-20' });
    expect(cliente.post).toHaveBeenCalledWith('/staff/tips/calculate', {
      sucursalId: 's-1',
      fecha: '2026-11-20',
    });

    cliente.post.mockResolvedValue({ ...rawPozo, estado: 'REPARTIDO' });
    const confirmado = await rrhhApi.confirmarPozo('p-1');
    expect(cliente.post).toHaveBeenLastCalledWith('/staff/tips/p-1/confirm', {});
    expect(confirmado.estado).toBe('REPARTIDO');
  });
});
