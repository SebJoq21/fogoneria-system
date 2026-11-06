/* Facturación electrónica SUNAT (SEE-OSE).
   Puerto FacturacionPort + adaptador mock intercambiable: al llegar la fase
   backend solo se cambia el adaptador por el OSE contratado (Nubefact, Apisunat…)
   o por emisión directa. Regla de oro: la venta nunca se detiene por SUNAT —
   el comprobante queda en cola y se reintenta (contingencia). */

import {
  isValidDni,
  isValidRuc,
  nowIso,
} from "./domain";
import type { CdrInfo, Receipt, ReceiptType } from "./erp";

export type CpePayload = {
  id: string;
  type: ReceiptType;
  at: string;
  customer: string;
  docType: "1" | "6" | "";
  docNumber: string;
  subtotal: number;
  igv: number;
  total: number;
  /** NC: comprobante que modifica. */
  refId?: string;
  motivo?: string;
};

export type ResultadoEnvio = {
  estado: "aceptado" | "rechazado" | "en_cola";
  cdr?: CdrInfo;
  mensaje: string;
};

/** Puerto de emisión electrónica (puertos y adaptadores: hexagonal). */
export interface FacturacionPort {
  /** Envía un CPE (boleta, factura o nota de crédito) al OSE/SUNAT. */
  enviar(cpe: CpePayload): Promise<ResultadoEnvio>;
  /** Comunicación de baja / resumen diario de boletas. */
  enviarBaja(ids: string[]): Promise<ResultadoEnvio>;
}

export function cpeFromReceipt(r: Receipt): CpePayload {
  return {
    id: r.id,
    type: r.type,
    at: r.at,
    customer: r.customer,
    docType: r.docType,
    docNumber: r.docNumber,
    subtotal: r.subtotal,
    igv: r.igv,
    total: r.total,
    refId: r.refId,
    motivo: r.motivoAnulacion,
  };
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Adaptador mock: simula validaciones y CDR del OSE con latencia breve. */
export class MockFacturacionAdapter implements FacturacionPort {
  private cdrSeq = 0;
  private contingencia = false;

  setContingencia(value: boolean) {
    this.contingencia = value;
  }

  isContingencia() {
    return this.contingencia;
  }

  private validar(cpe: CpePayload): string | null {
    if (cpe.type === "01" && cpe.docType !== "6") {
      return "Factura requiere RUC del receptor.";
    }
    if (cpe.docType === "6" && !isValidRuc(cpe.docNumber)) {
      return "RUC inválido: el dígito verificador no cumple SUNAT.";
    }
    if (cpe.docType === "1" && !isValidDni(cpe.docNumber)) {
      return "DNI inválido: debe tener 8 dígitos.";
    }
    return null;
  }

  private nextCdr(mensaje: string, codigo = "0"): CdrInfo {
    this.cdrSeq += 1;
    return {
      numero: `0000-0000-${String(this.cdrSeq).padStart(7, "0")}`,
      fecha: nowIso(),
      codigo,
      mensaje,
    };
  }

  async enviar(cpe: CpePayload): Promise<ResultadoEnvio> {
    await delay(300);
    if (this.contingencia) {
      return {
        estado: "en_cola",
        mensaje: "OSE no disponible: comprobante en cola (contingencia).",
      };
    }
    const error = this.validar(cpe);
    if (error) {
      return {
        estado: "rechazado",
        mensaje: error,
        cdr: this.nextCdr("RECHAZADO", "2800"),
      };
    }
    return {
      estado: "aceptado",
      mensaje: "CDR emitido por el OSE: comprobante con validez tributaria.",
      cdr: this.nextCdr("ACEPTADO"),
    };
  }

  async enviarBaja(ids: string[]): Promise<ResultadoEnvio> {
    await delay(250);
    if (this.contingencia) {
      return {
        estado: "en_cola",
        mensaje: "Resumen diario en cola (contingencia): se reintentará.",
      };
    }
    return {
      estado: "aceptado",
      mensaje: `Resumen diario procesado (${ids.length} documento(s)).`,
      cdr: this.nextCdr("RESUMEN ACEPTADO"),
    };
  }
}

let adapter: MockFacturacionAdapter | null = null;

/** Adaptador activo (mock por ahora; OSE real en fase backend). */
export function getFacturacionPort(): MockFacturacionAdapter {
  if (!adapter) adapter = new MockFacturacionAdapter();
  return adapter;
}
