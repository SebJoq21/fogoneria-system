/**
 * Cliente del módulo Salón (mesas + reservas).
 *
 * Habla con el BFF (`/api/backend`) a través del SDK compartido: el navegador
 * nunca conoce la URL de la API ni el token. La API responde snake_case; aquí
 * se traduce al contrato (`@fogoneria/contracts/mesas|reservas`).
 *
 * `OCUPADA` y `RESERVADA` los derivan las órdenes y las reservas: este cliente
 * solo escribe `LIBRE`/`MANTENIMIENTO` en el estado de una mesa.
 */

import { createClient, queryString } from '@fogoneria/sdk';
import {
  isEstadoMesa,
  type EstadoMesa,
  type EstadoMesaManual,
  type Mesa,
  type MesaInput,
  type MesaUpdate,
} from '@fogoneria/contracts/mesas';
import {
  isEstadoReserva,
  type EstadoReserva,
  type Reserva,
  type ReservaInput,
  type ReservaUpdate,
} from '@fogoneria/contracts/reservas';

export const salonClient = createClient({ baseUrl: '/api/backend' });

type ApiMesa = {
  id: string;
  numero: string;
  capacidad: number;
  zona: string | null;
  estado: string;
  forma: string | null;
  sucursal_id: string;
};

type ApiReserva = {
  id: string;
  codigo: string;
  sucursal_id: string;
  mesa_id: string;
  cliente_nombre: string;
  telefono: string | null;
  nro_comensales: number;
  fecha_hora: string;
  estado: string;
  canal: string | null;
  notas: string | null;
  mesas?: { id: string; numero: string; zona: string | null } | null;
};

type ApiReservaList = {
  items: ApiReserva[];
  total: number;
  page?: number;
  limit?: number;
};

export function toMesa(raw: ApiMesa): Mesa {
  return {
    id: raw.id,
    numero: raw.numero,
    capacidad: raw.capacidad,
    zona: raw.zona,
    estado: isEstadoMesa(raw.estado) ? raw.estado : 'LIBRE',
    forma: raw.forma === 'REDONDA' ? 'REDONDA' : 'RECTANGULAR',
    sucursalId: raw.sucursal_id,
  };
}

export function toReserva(raw: ApiReserva): Reserva {
  return {
    id: raw.id,
    codigo: raw.codigo,
    mesaId: raw.mesa_id,
    mesaNumero: raw.mesas?.numero ?? null,
    clienteNombre: raw.cliente_nombre,
    telefono: raw.telefono,
    comensales: raw.nro_comensales,
    fechaHora: raw.fecha_hora,
    estado: isEstadoReserva(raw.estado) ? raw.estado : 'POR_CONFIRMAR',
    canal: raw.canal,
    notas: raw.notas,
    sucursalId: raw.sucursal_id,
  };
}

export const salonApi = {
  async listMesas(
    params: { estado?: EstadoMesa; zona?: string; sucursalId?: string; signal?: AbortSignal } = {},
  ): Promise<Mesa[]> {
    const raw = await salonClient.get<ApiMesa[]>(
      `/tables${queryString({
        estado: params.estado,
        zona: params.zona,
        sucursalId: params.sucursalId,
      })}`,
      { signal: params.signal },
    );
    return raw.map(toMesa);
  },

  async createMesa(input: MesaInput): Promise<Mesa> {
    const raw = await salonClient.post<ApiMesa>('/tables', {
      numero: input.numero,
      capacidad: input.capacidad,
      ...(input.zona ? { zona: input.zona } : {}),
      ...(input.forma ? { forma: input.forma } : {}),
      ...(input.sucursalId ? { sucursalId: input.sucursalId } : {}),
    });
    return toMesa(raw);
  },

  async updateMesa(id: string, input: MesaUpdate): Promise<Mesa> {
    const raw = await salonClient.patch<ApiMesa>(`/tables/${id}`, {
      ...(input.numero !== undefined ? { numero: input.numero } : {}),
      ...(input.capacidad !== undefined ? { capacidad: input.capacidad } : {}),
      ...(input.zona !== undefined ? { zona: input.zona } : {}),
      ...(input.forma !== undefined ? { forma: input.forma } : {}),
    });
    return toMesa(raw);
  },

  /** Bloqueo manual: `MANTENIMIENTO` bloquea y `LIBRE` vuelve a disponible. */
  async updateMesaEstado(id: string, estado: EstadoMesaManual): Promise<Mesa> {
    const raw = await salonClient.patch<ApiMesa>(`/tables/${id}/status`, { estado });
    return toMesa(raw);
  },

  async deleteMesa(id: string): Promise<Mesa> {
    const raw = await salonClient.delete<ApiMesa>(`/tables/${id}`);
    return toMesa(raw);
  },

  async listReservas(
    params: { fecha?: string; estado?: EstadoReserva; mesaId?: string; signal?: AbortSignal } = {},
  ): Promise<Reserva[]> {
    const raw = await salonClient.get<ApiReservaList>(
      `/reservations${queryString({
        fecha: params.fecha,
        estado: params.estado,
        mesaId: params.mesaId,
        limit: 100,
      })}`,
      { signal: params.signal },
    );
    return raw.items.map(toReserva);
  },

  async createReserva(input: ReservaInput): Promise<Reserva> {
    const raw = await salonClient.post<ApiReserva>('/reservations', {
      mesaId: input.mesaId,
      clienteNombre: input.clienteNombre,
      ...(input.telefono ? { telefono: input.telefono } : {}),
      nroComensales: input.comensales,
      fechaHora: input.fechaHora,
      ...(input.canal ? { canal: input.canal } : {}),
      ...(input.notas ? { notas: input.notas } : {}),
    });
    return toReserva(raw);
  },

  async updateReserva(id: string, input: ReservaUpdate): Promise<Reserva> {
    const raw = await salonClient.patch<ApiReserva>(`/reservations/${id}`, {
      ...(input.mesaId ? { mesaId: input.mesaId } : {}),
      ...(input.clienteNombre ? { clienteNombre: input.clienteNombre } : {}),
      ...(input.telefono !== undefined ? { telefono: input.telefono } : {}),
      ...(input.comensales !== undefined ? { nroComensales: input.comensales } : {}),
      ...(input.fechaHora ? { fechaHora: input.fechaHora } : {}),
      ...(input.canal !== undefined ? { canal: input.canal } : {}),
      ...(input.notas !== undefined ? { notas: input.notas } : {}),
    });
    return toReserva(raw);
  },

  async updateReservaEstado(id: string, estado: EstadoReserva): Promise<Reserva> {
    const raw = await salonClient.patch<ApiReserva>(`/reservations/${id}/status`, { estado });
    return toReserva(raw);
  },
};
