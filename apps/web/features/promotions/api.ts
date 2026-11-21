/**
 * Cliente del módulo Promociones (combos, cupones y reglas horarias).
 *
 * Habla con el BFF (`/api/backend`) a través del SDK compartido. La API
 * responde snake_case; aquí se traduce al contrato
 * (`@fogoneria/contracts/promotions`).
 *
 * El descuento **no se calcula en el navegador**: `validarCupon` devuelve el
 * importe que calculó el servidor y el consumo del uso ocurre al cobrar. Las
 * vistas siguen leyendo el estado demo de `ModulesProvider`; este cliente deja
 * listo el contrato para conectarlas sin duplicar el mapeo.
 */

import { createClient, queryString } from '@fogoneria/sdk';
import {
  ahorroCombo,
  esTipoDescuentoCupon,
  type Combo,
  type ComboInput,
  type ComboPlato,
  type ComboUpdate,
  type Cupon,
  type CuponInput,
  type CuponUpdate,
  type ReglaHoraria,
  type TipoDescuentoCupon,
} from '@fogoneria/contracts/promotions';

export const promocionesClient = createClient({ baseUrl: '/api/backend' });

type DecimalLike = string | number;

/* ------------------------------ API cruda -------------------------------- */

export type ApiCombo = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio_fijo: DecimalLike;
  activo: boolean;
  combos_platos?: {
    plato_id: string;
    cantidad: number;
    platos?: { id: string; nombre: string } | null;
  }[];
  precioReferencia?: DecimalLike | null;
  ahorro?: DecimalLike | null;
  created_at?: string;
};

export type ApiCupon = {
  id: string;
  codigo: string;
  tipo_descuento: string;
  valor: DecimalLike;
  limite_usos: number;
  usos_actuales: number;
  vencimiento: string;
  activo: boolean;
  created_at?: string;
};

export type ApiReglaHoraria = {
  id: string;
  nombre: string;
  beneficio: string;
  dias_semana: number[];
  hora_inicio: string;
  hora_fin: string;
  activa: boolean;
  aplicaAhora?: boolean;
};

export type ValidacionCupon = {
  valido: boolean;
  motivo: string | null;
  /** Importe que calculó el servidor sobre el subtotal enviado. */
  descuento: number;
};

/* -------------------------------- mapeos --------------------------------- */

function numero(value: DecimalLike | null | undefined): number {
  return Number(value ?? 0);
}

export function toCombo(raw: ApiCombo): Combo {
  const platos: ComboPlato[] = (raw.combos_platos ?? []).map((plato) => ({
    platoId: plato.plato_id,
    cantidad: plato.cantidad,
    ...(plato.platos?.nombre ? { nombre: plato.platos.nombre } : {}),
  }));
  const precioFijo = numero(raw.precio_fijo);
  const precioReferencia =
    raw.precioReferencia === null || raw.precioReferencia === undefined
      ? null
      : numero(raw.precioReferencia);

  return {
    id: raw.id,
    nombre: raw.nombre,
    descripcion: raw.descripcion,
    precioFijo,
    activo: raw.activo,
    platos,
    precioReferencia,
    ahorro:
      raw.ahorro === null || raw.ahorro === undefined
        ? ahorroCombo(precioReferencia, precioFijo)
        : numero(raw.ahorro),
    ...(raw.created_at ? { createdAt: raw.created_at } : {}),
  };
}

export function toCupon(raw: ApiCupon): Cupon {
  const tipo: TipoDescuentoCupon = esTipoDescuentoCupon(raw.tipo_descuento)
    ? raw.tipo_descuento
    : 'PORCENTAJE';

  return {
    id: raw.id,
    codigo: raw.codigo,
    tipoDescuento: tipo,
    valor: numero(raw.valor),
    limiteUsos: raw.limite_usos,
    usosActuales: raw.usos_actuales,
    // El vencimiento viaja como ISO de medianoche; se queda el día de Lima.
    vencimiento: raw.vencimiento.slice(0, 10),
    activo: raw.activo,
    ...(raw.created_at ? { createdAt: raw.created_at } : {}),
  };
}

/**
 * `hora_inicio`/`hora_fin` llegan como `Time` de Postgres (`1970-01-01T18:00:00Z`).
 *
 * Prisma serializa el `time` (sin zona) como ISO con `Z`, pero los componentes
 * HH:MM son la hora de pared guardada (Lima): se extraen tal cual, sin restar
 * 5 horas. El test de `horaDeApi` fija esa suposición; si el driver cambia la
 * serialización, se verá ahí antes que en la agenda.
 */
export function horaDeApi(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (match) return `${match[4]}:${match[5]}`;
  return value;
}

export function toReglaHoraria(raw: ApiReglaHoraria): ReglaHoraria {
  return {
    id: raw.id,
    nombre: raw.nombre,
    beneficio: raw.beneficio,
    diasSemana: raw.dias_semana,
    horaInicio: horaDeApi(raw.hora_inicio),
    horaFin: horaDeApi(raw.hora_fin),
    activa: raw.activa,
    aplicaAhora: raw.aplicaAhora ?? false,
  };
}

function comboPayload(input: ComboInput | ComboUpdate) {
  return {
    ...(input.nombre !== undefined ? { nombre: input.nombre } : {}),
    ...(input.descripcion !== undefined ? { descripcion: input.descripcion } : {}),
    ...(input.precioFijo !== undefined ? { precioFijo: input.precioFijo } : {}),
    ...(input.activo !== undefined ? { activo: input.activo } : {}),
    ...(input.platos !== undefined
      ? {
          platos: input.platos.map((plato) => ({
            platoId: plato.platoId,
            cantidad: plato.cantidad,
          })),
        }
      : {}),
  };
}

/* -------------------------------- cliente -------------------------------- */

export const promocionesApi = {
  async listarCombos(signal?: AbortSignal): Promise<Combo[]> {
    const combos = await promocionesClient.get<ApiCombo[]>('/promotions/combos', { signal });
    return combos.map(toCombo);
  },

  async crearCombo(input: ComboInput): Promise<Combo> {
    return toCombo(await promocionesClient.post<ApiCombo>('/promotions/combos', comboPayload(input)));
  },

  async actualizarCombo(id: string, input: ComboUpdate): Promise<Combo> {
    return toCombo(
      await promocionesClient.patch<ApiCombo>(`/promotions/combos/${id}`, comboPayload(input)),
    );
  },

  async eliminarCombo(id: string): Promise<void> {
    await promocionesClient.delete(`/promotions/combos/${id}`);
  },

  async listarCupones(
    params: { activo?: boolean; page?: number; limit?: number; signal?: AbortSignal } = {},
  ): Promise<{ items: Cupon[]; total: number }> {
    const raw = await promocionesClient.get<{
      items: ApiCupon[];
      total: number;
      page: number;
      limit: number;
    }>(
      `/promotions/coupons${queryString({
        activo: params.activo === undefined ? undefined : params.activo,
        page: params.page,
        limit: params.limit,
      })}`,
      { signal: params.signal },
    );
    return { items: raw.items.map(toCupon), total: raw.total };
  },

  async crearCupon(input: CuponInput): Promise<Cupon> {
    return toCupon(
      await promocionesClient.post<ApiCupon>('/promotions/coupons', {
        codigo: input.codigo,
        tipoDescuento: input.tipoDescuento,
        valor: input.valor,
        limiteUsos: input.limiteUsos,
        vencimiento: input.vencimiento,
      }),
    );
  },

  async actualizarCupon(id: string, input: CuponUpdate): Promise<Cupon> {
    return toCupon(
      await promocionesClient.patch<ApiCupon>(`/promotions/coupons/${id}`, input),
    );
  },

  async eliminarCupon(id: string): Promise<void> {
    await promocionesClient.delete(`/promotions/coupons/${id}`);
  },

  /** Vista previa del descuento; el importe siempre lo calcula el servidor. */
  async validarCupon(codigo: string, subtotal: number): Promise<ValidacionCupon> {
    return promocionesClient.post<ValidacionCupon>(
      `/promotions/coupons/${encodeURIComponent(codigo)}/validate`,
      { subtotal },
    );
  },

  async schedule(signal?: AbortSignal): Promise<ReglaHoraria[]> {
    const reglas = await promocionesClient.get<ApiReglaHoraria[]>('/promotions/schedule', {
      signal,
    });
    return reglas.map(toReglaHoraria);
  },
};
