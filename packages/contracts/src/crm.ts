/**
 * Contratos del CRM: comensales, segmentos, puntos y configuración de lealtad.
 *
 * El **segmento lo calcula el servidor** a partir de las comandas `PAGADA`
 * (`NUEVO`/`FRECUENTE`/`VIP` según los umbrales de `config_lealtad`): la web
 * solo lo pinta, nunca lo edita a mano. Los puntos se mueven con movimientos
 * auditados (`GANANCIA`/`CANJE`/`CADUCIDAD`) y el importe se guarda siempre
 * positivo: el signo lo da el tipo.
 */

export type SegmentoCliente = 'NUEVO' | 'FRECUENTE' | 'VIP';

export const SEGMENTOS_CLIENTE: readonly SegmentoCliente[] = [
  'NUEVO',
  'FRECUENTE',
  'VIP',
];

export type TipoMovimientoPuntos = 'GANANCIA' | 'CANJE' | 'CADUCIDAD';

export const TIPOS_MOVIMIENTO_PUNTOS: readonly TipoMovimientoPuntos[] = [
  'GANANCIA',
  'CANJE',
  'CADUCIDAD',
];

export type Cliente = {
  id: string;
  nombre: string;
  /** Identificador de fidelidad: único por empresa. */
  telefono: string;
  segmento: SegmentoCliente;
  visitas: number;
  puntos: number;
  /** ISO de la última comanda pagada; `null` si nunca vino. */
  ultimaVisita: string | null;
  createdAt: string;
};

export type MovimientoPuntos = {
  id: string;
  tipo: TipoMovimientoPuntos;
  /** Siempre positivo: el signo lo da el tipo. */
  puntos: number;
  motivo: string | null;
  createdAt: string;
  /** Comanda que originó el consumo, si aplica. */
  ordenId: string | null;
};

export type ClienteDetalle = Cliente & {
  movimientos: MovimientoPuntos[];
};

export type ConfigLealtad = {
  puntosPorMoneda: number;
  caducidadMeses: number;
  /** Visitas para dejar de ser `NUEVO`. */
  umbralFrecuente: number;
  /** Visitas para llegar a `VIP`. */
  umbralVip: number;
};

export type ClienteInput = {
  nombre: string;
  telefono: string;
};

export type AjustePuntosInput = {
  tipo: TipoMovimientoPuntos;
  puntos: number;
  motivo?: string;
  /** Solo `ADMIN_GLOBAL`: los demás heredan la sucursal del token. */
  sucursalId?: string;
};

/* ------------------------------- etiquetas -------------------------------- */

export function esSegmentoCliente(value: string): value is SegmentoCliente {
  return (SEGMENTOS_CLIENTE as readonly string[]).includes(value);
}

export function esTipoMovimientoPuntos(value: string): value is TipoMovimientoPuntos {
  return (TIPOS_MOVIMIENTO_PUNTOS as readonly string[]).includes(value);
}

/** Etiqueta del segmento que usa el ERP. */
export function etiquetaSegmento(
  segmento: SegmentoCliente | string,
): 'Nuevo' | 'Frecuente' | 'VIP' {
  switch (segmento) {
    case 'VIP':
      return 'VIP';
    case 'FRECUENTE':
      return 'Frecuente';
    default:
      return 'Nuevo';
  }
}

/** Etiqueta legible del movimiento de puntos. */
export function etiquetaMovimientoPuntos(
  tipo: TipoMovimientoPuntos | string,
): 'Ganancia' | 'Canje' | 'Caducidad' {
  switch (tipo) {
    case 'CANJE':
      return 'Canje';
    case 'CADUCIDAD':
      return 'Caducidad';
    default:
      return 'Ganancia';
  }
}

/** Fecha corta (`dd/mm/aaaa`) para "última visita"; `—` si nunca vino. */
export function ultimaVisitaLabel(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  const dia = fecha.slice(0, 10);
  const [anio, mes, diaMes] = dia.split('-');
  if (!anio || !mes || !diaMes) return '—';
  return `${diaMes}/${mes}/${anio}`;
}

/* ------------------------------ validación -------------------------------- */

/**
 * Devuelve el mensaje de error o `null` si el ajuste es válido.
 *
 * Replica la regla del servidor: puntos enteros y positivos, tipo conocido y,
 * en canjes/caducidades, no descontar más de lo que el cliente tiene. El saldo
 * real siempre lo recalcula la API; esto evita un viaje inútil con 400.
 */
export function validarAjustePuntos(input: {
  tipo?: string;
  puntos?: number;
  saldo?: number;
}): string | null {
  if (!input.tipo || !esTipoMovimientoPuntos(input.tipo)) {
    return 'Tipo de movimiento inválido';
  }
  const puntos = input.puntos;
  if (puntos === undefined || !Number.isInteger(puntos) || puntos < 1) {
    return 'Los puntos deben ser un entero mayor a 0';
  }
  if (input.tipo !== 'GANANCIA' && input.saldo !== undefined && puntos > input.saldo) {
    return `El cliente solo tiene ${input.saldo} puntos: no se pueden descontar ${puntos}`;
  }
  return null;
}
