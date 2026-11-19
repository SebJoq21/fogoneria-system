/**
 * Cliente del módulo RRHH. Vive dentro de la feature: la web no conoce la API
 * ni el token, solo el BFF (`/api/backend`) a través del SDK compartido.
 */

import { createClient, queryString } from '@fogoneria/sdk';
import type {
  Asistencia,
  BloqueTurno,
  Empleado,
  EstadoAsistencia,
  EstadoPozo,
  MarcacionInput,
  PozoPropina,
  Turno,
  TurnoInput,
} from '@fogoneria/contracts/rrhh';

type RawEmpleado = {
  id: string;
  nombre: string;
  sucursal_id: string;
  activo: boolean;
  roles_empresa?: { nombre: string } | null;
};

type RawAsistencia = {
  id: string;
  empleado_id: string;
  fecha: string;
  estado: EstadoAsistencia;
  hora_entrada: string | null;
  hora_salida: string | null;
  fuente: string | null;
  empleados?: { id: string; nombre: string } | null;
};

type RawTurno = {
  id: string;
  fecha: string;
  bloque: BloqueTurno;
  empleados?: { id: string; nombre: string } | null;
};

type RawPozo = {
  id: string;
  fecha: string;
  total: string | number;
  nro_beneficiarios: number;
  estado: EstadoPozo;
};

export const rrhhClient = createClient({ baseUrl: '/api/backend' });

export function toEmpleado(raw: RawEmpleado): Empleado {
  return {
    id: raw.id,
    nombre: raw.nombre,
    sucursalId: raw.sucursal_id,
    activo: raw.activo,
    rol: raw.roles_empresa?.nombre ?? null,
  };
}

export function toAsistencia(raw: RawAsistencia): Asistencia {
  return {
    id: raw.id,
    empleadoId: raw.empleado_id,
    empleado: raw.empleados?.nombre ?? '',
    fecha: raw.fecha,
    estado: raw.estado,
    horaEntrada: raw.hora_entrada,
    horaSalida: raw.hora_salida,
    fuente: raw.fuente,
  };
}

export function toTurno(raw: RawTurno): Turno {
  return {
    id: raw.id,
    empleadoId: raw.empleados?.id ?? '',
    empleado: raw.empleados?.nombre ?? '',
    fecha: raw.fecha,
    bloque: raw.bloque,
  };
}

export function toPozo(raw: RawPozo): PozoPropina {
  return {
    id: raw.id,
    fecha: raw.fecha,
    total: Number(raw.total ?? 0),
    beneficiarios: raw.nro_beneficiarios,
    estado: raw.estado,
  };
}

export const rrhhApi = {
  async listEmpleados(
    params: { sucursalId?: string; activo?: boolean; signal?: AbortSignal } = {},
  ): Promise<Empleado[]> {
    const raw = await rrhhClient.get<RawEmpleado[]>(
      `/staff/employees${queryString({
        sucursalId: params.sucursalId,
        activo: params.activo === undefined ? undefined : String(params.activo),
      })}`,
      { signal: params.signal },
    );
    return raw.map(toEmpleado);
  },

  async listAsistencias(
    params: { sucursalId?: string; fecha?: string; signal?: AbortSignal } = {},
  ): Promise<Asistencia[]> {
    const raw = await rrhhClient.get<RawAsistencia[]>(
      `/staff/attendance${queryString({
        sucursalId: params.sucursalId,
        fecha: params.fecha,
      })}`,
      { signal: params.signal },
    );
    return raw.map(toAsistencia);
  },

  async marcar(input: MarcacionInput): Promise<Asistencia> {
    const raw = await rrhhClient.post<RawAsistencia>('/staff/attendance', input);
    return toAsistencia(raw);
  },

  async listTurnos(
    params: { sucursalId?: string; fecha?: string; signal?: AbortSignal } = {},
  ): Promise<Turno[]> {
    const raw = await rrhhClient.get<RawTurno[]>(
      `/staff/shifts${queryString({ sucursalId: params.sucursalId, fecha: params.fecha })}`,
      { signal: params.signal },
    );
    return raw.map(toTurno);
  },

  async crearTurno(input: TurnoInput): Promise<Turno> {
    const raw = await rrhhClient.post<RawTurno>('/staff/shifts', input);
    return toTurno(raw);
  },

  async quitarTurno(id: string): Promise<void> {
    await rrhhClient.delete<{ id: string }>(`/staff/shifts/${id}`);
  },

  async listPozos(
    params: { sucursalId?: string; signal?: AbortSignal } = {},
  ): Promise<PozoPropina[]> {
    const raw = await rrhhClient.get<RawPozo[]>(
      `/staff/tips${queryString({ sucursalId: params.sucursalId })}`,
      { signal: params.signal },
    );
    return raw.map(toPozo);
  },

  async calcularPozo(input: { sucursalId?: string; fecha?: string }): Promise<PozoPropina> {
    const raw = await rrhhClient.post<RawPozo>('/staff/tips/calculate', input);
    return toPozo(raw);
  },

  async confirmarPozo(id: string): Promise<PozoPropina> {
    const raw = await rrhhClient.post<RawPozo>(`/staff/tips/${id}/confirm`, {});
    return toPozo(raw);
  },
};
