/* Traducción de comprobantes de la API al modelo de la UI (AYCDS-46 parte 2).

   La vista es la misma para demo y para API: aquí se rellena la forma `Receipt`
   que ya consumen la tabla, el resumen y el modal de anulación. Lo que **no**
   se inventa es SUNAT: con API real queda «pendiente de OSE» (estado en cola sin
   CDR) hasta que exista la integración. */

import type { Receipt } from "@/lib/erp";
import { fmtDateTime, splitIgv } from "@/lib/domain";
import type { ApiReceipt } from "@/lib/receipts-api";

/** Un comprobante de la API con la forma que pinta el ERP. */
export function receiptFromApi(api: ApiReceipt): Receipt {
  const total = Number(api.total ?? 0);
  const { subtotal, igv } = splitIgv(total);
  const anulada = api.estado === "ANULADA";

  return {
    id: api.serie_numero,
    type: api.tipo === "FACTURA" ? "01" : "03",
    at: api.created_at,
    date: fmtDateTime(api.created_at),
    customer: api.cliente_ref?.trim() || "Consumidor final",
    // `cliente_ref` guarda el documento tal cual lo escribió el cajero.
    docType: "",
    docNumber: api.cliente_ref ?? "",
    subtotal,
    igv,
    total,
    status: anulada ? "Anulada" : "Emitida",
    source: api.ordenes?.numero_orden ?? api.orden_id.slice(0, 8),
    motivoAnulacion: api.motivo_anulacion ?? undefined,
    estadoSunat: "en_cola",
    mensajeSunat: "Pendiente de integración con OSE",
    intentosEnvio: 0,
  };
}

/** Filas de la tabla a partir de la respuesta de `listReceipts`. */
export function receiptsFromApi(items: ApiReceipt[]): Receipt[] {
  return items.map(receiptFromApi);
}
