import { describe, expect, it } from "vitest";
import {
  REALTIME_EVENT as EVENTO_CONTRATO,
  REALTIME_NAMESPACE as NAMESPACE_CONTRATO,
  salaEmpresa,
  salaOrden,
  salaSucursal,
  type EventoTiempoReal,
} from "@fogoneria/contracts/tiempo-real";
import {
  REALTIME_EVENT,
  REALTIME_NAMESPACE,
  createDeduper,
  realtimeBaseUrl,
} from "./realtime";

describe("realtimeBaseUrl", () => {
  it("quita el prefijo /api/v1 de la URL de la API", () => {
    expect(realtimeBaseUrl("http://localhost:3001/api/v1")).toBe("http://localhost:3001");
    expect(realtimeBaseUrl("https://api.fogoneria.pe/api/v1/")).toBe(
      "https://api.fogoneria.pe",
    );
  });

  it("no toca una URL que ya es la base", () => {
    expect(realtimeBaseUrl("http://localhost:3001")).toBe("http://localhost:3001");
  });
});

describe("createDeduper", () => {
  it("descarta un eventId repetido", () => {
    const isFresh = createDeduper();
    expect(isFresh("a")).toBe(true);
    expect(isFresh("a")).toBe(false);
    expect(isFresh("b")).toBe(true);
  });

  it("respeta el límite y olvida los más viejos", () => {
    const isFresh = createDeduper(2);
    expect(isFresh("a")).toBe(true);
    expect(isFresh("b")).toBe(true);
    expect(isFresh("c")).toBe(true);
    // "a" ya salió de la ventana: se acepta otra vez.
    expect(isFresh("a")).toBe(true);
  });

  it("acepta eventos sin eventId (servidor viejo)", () => {
    const isFresh = createDeduper();
    expect(isFresh("")).toBe(true);
  });
});

describe("contrato de tiempo real", () => {
  it("usa los mismos eventos y namespace que el contrato compartido", () => {
    expect(REALTIME_EVENT).toEqual(EVENTO_CONTRATO);
    expect(REALTIME_NAMESPACE).toBe(NAMESPACE_CONTRATO);
  });

  it("cubre los cuatro eventos de dominio sin repetir nombres", () => {
    const dominio: EventoTiempoReal[] = [
      REALTIME_EVENT.orderCreated,
      REALTIME_EVENT.orderUpdated,
      REALTIME_EVENT.orderSla,
      REALTIME_EVENT.tableStatus,
    ];
    expect(new Set(dominio).size).toBe(4);
    expect(dominio).toContain("order.created");
    expect(dominio).toContain("table.status");
  });

  it("arma los rooms con el formato que espera el gateway", () => {
    expect(salaEmpresa("e1")).toBe("empresa:e1");
    expect(salaSucursal("e1", "s1")).toBe("empresa:e1:sucursal:s1");
    expect(salaOrden("o1")).toBe("order:o1");
  });
});
