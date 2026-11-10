import { describe, expect, it } from "vitest";
import { receiptFromApi, receiptsFromApi } from "./receipt-mapping";
import type { ApiReceipt } from "./receipts-api";

const BASE: ApiReceipt = {
  id: "r1",
  empresa_id: "e1",
  sucursal_id: "s1",
  tipo: "BOLETA",
  serie_numero: "B001-000123",
  orden_id: "11111111-1111-4111-8111-111111111111",
  cliente_ref: "45678901",
  total: "118.00",
  estado: "PAGADA",
  emitido_por: "u1",
  anulado_por: null,
  anulado_at: null,
  motivo_anulacion: null,
  created_at: "2026-11-06T18:00:00.000Z",
  ordenes: { id: "o1", numero_orden: "ORD-000123" },
};

describe("receiptFromApi (AYCDS-46 p2)", () => {
  it("traduce una boleta pagada y desglosa el IGV", () => {
    const receipt = receiptFromApi(BASE);

    expect(receipt.id).toBe("B001-000123");
    expect(receipt.type).toBe("03");
    expect(receipt.total).toBe(118);
    expect(receipt.subtotal).toBe(100);
    expect(receipt.igv).toBe(18);
    expect(receipt.status).toBe("Emitida");
    expect(receipt.source).toBe("ORD-000123");
  });

  it("marca la factura con el código 01", () => {
    const receipt = receiptFromApi({ ...BASE, tipo: "FACTURA", serie_numero: "F001-000004" });

    expect(receipt.type).toBe("01");
    expect(receipt.id).toBe("F001-000004");
  });

  it("una anulada conserva el motivo", () => {
    const receipt = receiptFromApi({
      ...BASE,
      estado: "ANULADA",
      motivo_anulacion: "Error en el documento",
    });

    expect(receipt.status).toBe("Anulada");
    expect(receipt.motivoAnulacion).toBe("Error en el documento");
  });

  it("SUNAT queda pendiente de OSE, sin inventar CDR", () => {
    const receipt = receiptFromApi(BASE);

    expect(receipt.estadoSunat).toBe("en_cola");
    expect(receipt.cdr).toBeUndefined();
    expect(receipt.mensajeSunat).toMatch(/OSE/i);
    expect(receipt.intentosEnvio).toBe(0);
  });

  it("sin cliente_ref cae a consumidor final", () => {
    const receipt = receiptFromApi({ ...BASE, cliente_ref: null });

    expect(receipt.customer).toBe("Consumidor final");
    expect(receipt.docNumber).toBe("");
  });

  it("sin orden usa el prefijo del UUID como origen", () => {
    const receipt = receiptFromApi({ ...BASE, ordenes: null });

    expect(receipt.source).toBe(BASE.orden_id.slice(0, 8));
  });

  it("mapea la lista completa", () => {
    expect(receiptsFromApi([BASE, { ...BASE, id: "r2" }])).toHaveLength(2);
  });
});
