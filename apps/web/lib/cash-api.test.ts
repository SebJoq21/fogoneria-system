import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chargeOrder,
  closeShift,
  createMovement,
  getCurrentShift,
  listMovements,
  metodoFromUi,
  metodoToUi,
  openShift,
  tipoToUi,
} from "./cash-api";

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

const turno = {
  id: "t-1",
  empresa_id: "e-1",
  sucursal_id: "s-1",
  cajero_id: "u-1",
  apertura_at: "2026-11-06T10:00:00.000Z",
  cierre_at: null,
  fondo_apertura: "100.00",
  ingresos_total: "41.00",
  egresos_total: "0.00",
  saldo: null,
  efectivo_contado: null,
  diferencia: null,
  observaciones: null,
  estado: "ABIERTO" as const,
};

describe("getCurrentShift", () => {
  it("devuelve null cuando no hay turno abierto", async () => {
    mockFetch(null);
    expect(await getCurrentShift()).toBeNull();
  });

  it("devuelve el turno con su arqueo", async () => {
    mockFetch({ turno, arqueo: { fondo: 100, ingresos: 41 } });
    const state = await getCurrentShift();
    expect(state?.turno.id).toBe("t-1");
    expect(state?.arqueo.fondo).toBe(100);
  });
});

describe("turnos", () => {
  it("abre con el fondo de apertura", async () => {
    const spy = mockFetch({ turno, arqueo: {} });
    await openShift(150);

    const { url, init, body } = callOf(spy);
    expect(url).toBe("/api/backend/cash/shifts");
    expect(init.method).toBe("POST");
    expect(body).toEqual({ fondoApertura: 150 });
  });

  it("cierra con el efectivo contado y observaciones", async () => {
    const spy = mockFetch({ turno: { ...turno, estado: "CERRADO" }, arqueo: {} });
    await closeShift("t-1", { efectivoContado: 141, observaciones: "cuadra" });

    const { url, init, body } = callOf(spy);
    expect(url).toBe("/api/backend/cash/shifts/t-1/close");
    expect(init.method).toBe("PATCH");
    expect(body).toEqual({ efectivoContado: 141, observaciones: "cuadra" });
  });

  it("no envía observaciones vacías", async () => {
    const spy = mockFetch({ turno, arqueo: {} });
    await closeShift("t-1", { efectivoContado: 0 });

    expect(callOf(spy).body).toEqual({ efectivoContado: 0 });
  });
});

describe("movimientos", () => {
  it("filtra por turno y tipo", async () => {
    const spy = mockFetch({ items: [], total: 0, page: 1, limit: 20, turnoId: "t-1" });
    await listMovements({ turnoId: "t-1", tipo: "EGRESO" });

    expect(callOf(spy).url).toBe("/api/backend/cash/movements?turnoId=t-1&tipo=EGRESO");
  });

  it("registra un egreso con el método en el enum de la API", async () => {
    const spy = mockFetch({ id: "m-1" });
    await createMovement({
      tipo: "EGRESO",
      concepto: "Compra de hielo",
      monto: 20,
      metodo: "EFECTIVO",
    });

    expect(callOf(spy).body).toEqual({
      tipo: "EGRESO",
      concepto: "Compra de hielo",
      monto: 20,
      metodo: "EFECTIVO",
    });
  });
});

describe("cobro", () => {
  it("cobra la comanda con propina", async () => {
    const spy = mockFetch({ ordenId: "o-1", pagada: true });
    await chargeOrder({ ordenId: "o-1", metodo: "YAPE", propina: 5 });

    const { url, init, body } = callOf(spy);
    expect(url).toBe("/api/backend/cash/charges");
    expect(init.method).toBe("POST");
    expect(body).toEqual({ ordenId: "o-1", metodo: "YAPE", propina: 5 });
  });

  it("no manda monto si no hay pago parcial", async () => {
    const spy = mockFetch({ pagada: true });
    await chargeOrder({ ordenId: "o-1", metodo: "EFECTIVO" });

    expect(callOf(spy).body).toEqual({ ordenId: "o-1", metodo: "EFECTIVO" });
  });
});

describe("traducciones de la UI", () => {
  it("mapea los métodos del dominio al enum", () => {
    expect(metodoFromUi("Efectivo")).toBe("EFECTIVO");
    expect(metodoFromUi("Yape")).toBe("YAPE");
    expect(metodoFromUi("Plin")).toBe("YAPE");
    expect(metodoFromUi("Tarjeta")).toBe("TARJETA");
    expect(metodoFromUi("Transferencia")).toBe("TRANSFERENCIA");
    expect(metodoFromUi("otro")).toBe("EFECTIVO");
  });

  it("mapea el enum a la etiqueta", () => {
    expect(metodoToUi("EFECTIVO")).toBe("Efectivo");
    expect(metodoToUi("YAPE")).toBe("Yape");
    expect(metodoToUi("TARJETA")).toBe("Tarjeta");
    expect(metodoToUi("TRANSFERENCIA")).toBe("Transferencia");
  });

  it("traduce el tipo de movimiento", () => {
    expect(tipoToUi("INGRESO")).toBe("Ingreso");
    expect(tipoToUi("EGRESO")).toBe("Egreso");
  });
});
