/**
 * Contratos de comprobantes de pago (AYCDS-36).
 *
 * El comprobante documenta un cobro que ya existe: se emite **solo** sobre una
 * comanda `PAGADA`. El correlativo lo pone el servidor por serie; el IGV se
 * deriva del total (18 % incluido), nunca se guarda.
 *
 * `NOTA_CREDITO` existe en el tipo porque el ERP la muestra en el demo, pero la
 * API todavía no la emite: la anulación de una factura queda a cargo del OSE.
 */

export type TipoComprobante = 'BOLETA' | 'FACTURA' | 'TICKET' | 'NOTA_CREDITO';

export type TipoComprobanteEmisible = Exclude<TipoComprobante, 'NOTA_CREDITO'>;

export type EstadoComprobante = 'PAGADA' | 'ANULADA';

export type Comprobante = {
  id: string;
  sucursalId: string;
  tipo: TipoComprobante;
  /** Serie y correlativo (`B001-00000042`). */
  serieNumero: string;
  ordenId: string;
  /** Folio de la comanda (`ORD-000123`), si la API lo trae anidado. */
  ordenNumero: string | null;
  /** RUC o DNI del cliente tal como lo escribió el cajero. */
  clienteRef: string | null;
  total: number;
  estado: EstadoComprobante;
  emitidoPor: string | null;
  anuladoPor: string | null;
  anuladoAt: string | null;
  motivoAnulacion: string | null;
  createdAt: string;
};

export type EmisionComprobanteInput = {
  ordenId: string;
  tipo: TipoComprobanteEmisible;
  clienteRef?: string;
};

/** Desglose de un total que ya incluye IGV. */
export type DesgloseIgv = {
  base: number;
  igv: number;
  total: number;
  tasa: number;
};

export const TIPOS_COMPROBANTE: readonly TipoComprobante[] = [
  'BOLETA',
  'FACTURA',
  'TICKET',
  'NOTA_CREDITO',
];

export const ESTADOS_COMPROBANTE: readonly EstadoComprobante[] = ['PAGADA', 'ANULADA'];

/** Tasa de IGV vigente en Perú (18 %), incluida en el precio de carta. */
export const IGV_TASA = 18;

/** Lo que la UI muestra mientras no exista la integración con el OSE. */
export const SUNAT_PENDIENTE_OSE = 'Pendiente de OSE';

const SERIE_POR_TIPO: Record<TipoComprobante, string> = {
  BOLETA: 'B001',
  FACTURA: 'F001',
  TICKET: 'T001',
  NOTA_CREDITO: 'FC01',
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function esTipoComprobante(value: string): value is TipoComprobante {
  return (TIPOS_COMPROBANTE as readonly string[]).includes(value);
}

export function esEstadoComprobante(value: string): value is EstadoComprobante {
  return (ESTADOS_COMPROBANTE as readonly string[]).includes(value);
}

/** Una nota de crédito no se emite de cero: se deriva de una factura. */
export function esEmisible(tipo: TipoComprobante): tipo is TipoComprobanteEmisible {
  return tipo !== 'NOTA_CREDITO';
}

/** `base = total / 1.18`, `igv = total - base`, ambos a 2 decimales. */
export function desgloseIgv(total: number, tasa: number = IGV_TASA): DesgloseIgv {
  const bruto = Number.isFinite(total) ? total : 0;
  const base = round2(bruto / (1 + tasa / 100));
  return { base, igv: round2(bruto - base), total: round2(bruto), tasa };
}

/**
 * Valida la emisión antes de llamar a la API: comanda, tipo y documento.
 * El dígito verificador del RUC lo comprueba el servidor (módulo 11 SUNAT).
 */
export function validarEmision(input: {
  ordenId?: string;
  tipo?: string;
  clienteRef?: string;
}): string | null {
  if (!input.ordenId || !input.ordenId.trim()) return 'Falta la comanda cobrada';
  if (!input.tipo || !esTipoComprobante(input.tipo) || !esEmisible(input.tipo)) {
    return 'Tipo de comprobante inválido';
  }

  const ref = input.clienteRef?.trim() ?? '';
  if (input.tipo === 'FACTURA') {
    if (!ref) return 'La factura requiere el RUC del cliente';
    if (!/^\d{11}$/.test(ref)) return 'El RUC debe tener 11 dígitos';
    return null;
  }

  if (ref && !/^\d{8}$/.test(ref)) return 'El DNI de la boleta debe tener 8 dígitos';
  return null;
}

export function serieDeTipo(tipo: TipoComprobante): string {
  return SERIE_POR_TIPO[tipo];
}

/** Etiqueta del tipo para la UI. */
export function etiquetaTipoComprobante(tipo: TipoComprobante): string {
  switch (tipo) {
    case 'FACTURA':
      return 'Factura';
    case 'TICKET':
      return 'Ticket';
    case 'NOTA_CREDITO':
      return 'Nota de crédito';
    default:
      return 'Boleta';
  }
}

export function etiquetaEstadoComprobante(estado: EstadoComprobante): string {
  return estado === 'ANULADA' ? 'Anulada' : 'Pagada';
}
