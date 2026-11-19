/**
 * Cliente del módulo Caja (turnos, movimientos, arqueo y cobro).
 *
 * Habla con el BFF (`/api/backend`) a través del SDK compartido: el navegador
 * nunca conoce la URL de la API ni el token. La API responde snake_case; aquí
 * se traduce al contrato (`@fogoneria/contracts/caja`).
 *
 * `PAGADA` no se escribe desde órdenes: el cobro es `POST /cash/charges` y el
 * servidor decide si la comanda queda pagada o con saldo.
 */

import { createClient, queryString } from '@fogoneria/sdk';
import {
  esEstadoTurno,
  esMetodoPago,
  esTipoMovimiento,
  type Arqueo,
  type AperturaInput,
  type CierreInput,
  type CobroInput,
  type MovimientoCaja,
  type MovimientoInput,
  type ResultadoCobro,
  type TipoMovimiento,
  type TurnoCaja,
  type TurnoCajaActual,
} from '@fogoneria/contracts/caja';

export const cajaClient = createClient({ baseUrl: '/api/backend' });

type DecimalLike = string | number;

/** Turno tal como lo devuelve la API (`snake_case`). */
export type ApiTurno = {
  id: string;
  sucursal_id: string;
  cajero_id: string | null;
  apertura_at: string;
  cierre_at: string | null;
  fondo_apertura: DecimalLike;
  ingresos_total: DecimalLike;
  egresos_total: DecimalLike;
  saldo: DecimalLike | null;
  efectivo_contado: DecimalLike | null;
  diferencia: DecimalLike | null;
  observaciones: string | null;
  estado: string;
  usuarios?: { id: string; nombre: string } | null;
};

export type ApiMovimiento = {
  id: string;
  turno_id: string;
  tipo: string;
  concepto: string;
  monto: DecimalLike;
  metodo: string;
  orden_id: string | null;
  gasto_id: string | null;
  created_at: string;
  usuarios?: { id: string; nombre: string } | null;
};

export type ApiArqueo = Arqueo;

export type ApiTurnoActual = { turno: ApiTurno; arqueo: ApiArqueo } | null;

export type ApiMovimientoList = {
  items: ApiMovimiento[];
  total: number;
  page: number;
  limit: number;
  turnoId: string;
};

type ApiCobro = ResultadoCobro;

function num(value: DecimalLike | null | undefined): number {
  return Number(value ?? 0);
}

function numOrNull(value: DecimalLike | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

export function toTurno(raw: ApiTurno): TurnoCaja {
  return {
    id: raw.id,
    sucursalId: raw.sucursal_id,
    cajeroId: raw.cajero_id,
    cajero: raw.usuarios?.nombre ?? null,
    aperturaAt: raw.apertura_at,
    cierreAt: raw.cierre_at,
    fondoApertura: num(raw.fondo_apertura),
    ingresosTotal: num(raw.ingresos_total),
    egresosTotal: num(raw.egresos_total),
    saldo: numOrNull(raw.saldo),
    efectivoContado: numOrNull(raw.efectivo_contado),
    diferencia: numOrNull(raw.diferencia),
    observaciones: raw.observaciones,
    estado: esEstadoTurno(raw.estado) ? raw.estado : 'CERRADO',
  };
}

export function toMovimiento(raw: ApiMovimiento): MovimientoCaja {
  return {
    id: raw.id,
    turnoId: raw.turno_id,
    tipo: esTipoMovimiento(raw.tipo) ? raw.tipo : 'INGRESO',
    concepto: raw.concepto,
    monto: num(raw.monto),
    metodo: esMetodoPago(raw.metodo) ? raw.metodo : 'EFECTIVO',
    ordenId: raw.orden_id,
    gastoId: raw.gasto_id,
    actor: raw.usuarios?.nombre ?? null,
    createdAt: raw.created_at,
  };
}

/** `null` si la sucursal no tiene turno abierto. */
export function turnoActualDesdeApi(raw: ApiTurnoActual): TurnoCajaActual {
  return raw?.turno ? { turno: toTurno(raw.turno), arqueo: raw.arqueo } : null;
}

export function cobroDesdeApi(raw: ApiCobro): ResultadoCobro {
  return {
    ordenId: raw.ordenId,
    numeroOrden: raw.numeroOrden,
    turnoId: raw.turnoId,
    cobrado: num(raw.cobrado),
    propina: num(raw.propina),
    total: num(raw.total),
    pendiente: num(raw.pendiente),
    pagada: Boolean(raw.pagada),
  };
}

export const cajaApi = {
  async getTurnoActual(signal?: AbortSignal): Promise<TurnoCajaActual> {
    const raw = await cajaClient.get<ApiTurnoActual>('/cash/shifts/current', { signal });
    return turnoActualDesdeApi(raw);
  },

  async abrirTurno(input: AperturaInput): Promise<TurnoCajaActual> {
    const raw = await cajaClient.post<ApiTurnoActual>('/cash/shifts', {
      fondoApertura: input.fondoApertura,
      ...(input.sucursalId ? { sucursalId: input.sucursalId } : {}),
    });
    return turnoActualDesdeApi(raw);
  },

  async cerrarTurno(
    id: string,
    input: CierreInput,
  ): Promise<{ turno: TurnoCaja; arqueo: Arqueo }> {
    const raw = await cajaClient.patch<{ turno: ApiTurno; arqueo: Arqueo }>(
      `/cash/shifts/${id}/close`,
      {
        efectivoContado: input.efectivoContado,
        ...(input.observaciones ? { observaciones: input.observaciones } : {}),
      },
    );
    return { turno: toTurno(raw.turno), arqueo: raw.arqueo };
  },

  async listarTurnos(
    params: { desde?: string; hasta?: string; limit?: number; signal?: AbortSignal } = {},
  ): Promise<{ items: TurnoCaja[]; total: number }> {
    const raw = await cajaClient.get<{ items: ApiTurno[]; total: number }>(
      `/cash/shifts${queryString({
        desde: params.desde,
        hasta: params.hasta,
        limit: params.limit,
      })}`,
      { signal: params.signal },
    );
    return { items: raw.items.map(toTurno), total: raw.total };
  },

  async listarMovimientos(
    params: { turnoId?: string; tipo?: TipoMovimiento; signal?: AbortSignal } = {},
  ): Promise<{ items: MovimientoCaja[]; total: number; turnoId: string }> {
    const raw = await cajaClient.get<ApiMovimientoList>(
      `/cash/movements${queryString({ turnoId: params.turnoId, tipo: params.tipo })}`,
      { signal: params.signal },
    );
    return {
      items: raw.items.map(toMovimiento),
      total: raw.total,
      turnoId: raw.turnoId,
    };
  },

  async crearMovimiento(input: MovimientoInput): Promise<MovimientoCaja> {
    const raw = await cajaClient.post<ApiMovimiento>('/cash/movements', {
      tipo: input.tipo,
      concepto: input.concepto,
      monto: input.monto,
      metodo: input.metodo,
      ...(input.sucursalId ? { sucursalId: input.sucursalId } : {}),
    });
    return toMovimiento(raw);
  },

  async cobrar(input: CobroInput): Promise<ResultadoCobro> {
    const raw = await cajaClient.post<ApiCobro>('/cash/charges', {
      ordenId: input.ordenId,
      metodo: input.metodo,
      ...(input.monto !== undefined ? { monto: input.monto } : {}),
      ...(input.propina !== undefined ? { propina: input.propina } : {}),
    });
    return cobroDesdeApi(raw);
  },
};

/** Los métodos del dominio (`Efectivo`, `Yape`…) al enum de la API. */
export {
  etiquetaMetodo as metodoToUi,
  etiquetaTipoMovimiento as tipoToUi,
  metodoDeEtiqueta as metodoFromUi,
} from '@fogoneria/contracts/caja';
