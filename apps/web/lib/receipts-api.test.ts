import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createReceipt,
  fechaLima,
  listReceipts,
  receiptSunatCode,
  receiptTypeLabel,
  voidReceipt,
} from "./receipts-api";

function mockFetch(body: unknown = {}) {
  const spy = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", spy);
  return spy;
}

function callOf(spy: ReturnType<typeof mockFetch>, index = 0) {
  const [url, init] = spy.mock.calls[index] as unknown as [string, RequestInit];
  return { url, init, body: init?.body ? JSON.parse(init.body as string) : undefined };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listReceipts", () => {
  it("arma la query con fecha, tipo y estado", async () => {
    const spy = mockFetch({ items: [], total: 0, page: 1, limit: 20 });
    await listReceipts({ fecha: "2026-11-06", tipo: "BOLETA", estado: "PAGADA" });

    expect(callOf(spy).url).toBe(
      "/api/backend/receipts?fecha=2026-11-06&tipo=BOLETA&estado=PAGADA",
    );
  });

  it("sin filtros llama al listado base", async () => {
    const spy = mockFetch({ items: [], total: 0, page: 1, limit: 20 });
    await listReceipts();

    expect(callOf(spy).url).toBe("/api/backend/receipts");
  });
});

describe("createReceipt", () => {
  it("emite la boleta con el documento del cliente", async () => {
    const spy = mockFetch({ comprobante: { id: "c-1" }, desglose: {} });
    await createReceipt({ ordenId: "o-1", tipo: "BOLETA", clienteRef: "12345678" });

    const { url, init, body } = callOf(spy);
    expect(url).toBe("/api/backend/receipts");
    expect(init.method).toBe("POST");
    expect(body).toEqual({ ordenId: "o-1", tipo: "BOLETA", clienteRef: "12345678" });
  });

  it("no manda clienteRef vacío", async () => {
    const spy = mockFetch({ comprobante: {}, desglose: {} });
    await createReceipt({ ordenId: "o-1", tipo: "TICKET" });

    expect(callOf(spy).body).toEqual({ ordenId: "o-1", tipo: "TICKET" });
  });
});

describe("voidReceipt", () => {
  it("anula con el motivo", async () => {
    const spy = mockFetch({ comprobante: { estado: "ANULADA" }, desglose: {} });
    await voidReceipt("c-1", "Cliente desistió");

    const { url, init, body } = callOf(spy);
    expect(url).toBe("/api/backend/receipts/c-1/void");
    expect(init.method).toBe("POST");
    expect(body).toEqual({ motivo: "Cliente desistió" });
  });
});

describe("etiquetas", () => {
  it("nombra los tipos", () => {
    expect(receiptTypeLabel("BOLETA")).toBe("Boleta");
    expect(receiptTypeLabel("FACTURA")).toBe("Factura");
    expect(receiptTypeLabel("TICKET")).toBe("Ticket");
  });

  it("mapea al código SUNAT", () => {
    expect(receiptSunatCode("FACTURA")).toBe("01");
    expect(receiptSunatCode("BOLETA")).toBe("03");
    expect(receiptSunatCode("TICKET")).toBe("03");
  });

  it("calcula la fecha de Lima con offset fijo", () => {
    // 2026-11-07 02:00 UTC = 2026-11-06 21:00 en Lima.
    expect(fechaLima(new Date("2026-11-07T02:00:00.000Z"))).toBe("2026-11-06");
  });
});
