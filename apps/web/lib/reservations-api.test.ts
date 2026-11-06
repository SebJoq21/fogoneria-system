import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createReservation,
  listReservations,
  updateReservation,
  updateReservationStatus,
} from "./reservations-api";

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

describe("listReservations", () => {
  it("filtra por día de Lima y página", async () => {
    const spy = mockFetch({ items: [], total: 0 });
    await listReservations({ fecha: "2026-10-29", estado: "CONFIRMADA", page: 2, limit: 50 });

    const { url, init } = callOf(spy);
    expect(url).toBe(
      "/api/backend/reservations?fecha=2026-10-29&estado=CONFIRMADA&page=2&limit=50",
    );
    expect(init.method).toBe("GET");
  });
});

describe("createReservation", () => {
  it("envía mesa, cliente, comensales y fecha con offset de Lima", async () => {
    const spy = mockFetch({ id: "rsv-1" });
    await createReservation({
      mesaId: "mesa-1",
      clienteNombre: "Familia Rojas",
      telefono: "987654321",
      nroComensales: 4,
      fechaHora: "2026-10-29T20:00:00-05:00",
      notas: "Junto a la ventana",
    });

    const { url, init, body } = callOf(spy);
    expect(url).toBe("/api/backend/reservations");
    expect(init.method).toBe("POST");
    expect(body).toEqual({
      mesaId: "mesa-1",
      clienteNombre: "Familia Rojas",
      telefono: "987654321",
      nroComensales: 4,
      fechaHora: "2026-10-29T20:00:00-05:00",
      notas: "Junto a la ventana",
    });
  });

  it("no manda teléfono ni notas vacías", async () => {
    const spy = mockFetch({ id: "rsv-1" });
    await createReservation({
      mesaId: "mesa-1",
      clienteNombre: "Familia Rojas",
      nroComensales: 2,
      fechaHora: "2026-10-29T20:00:00-05:00",
    });

    expect(callOf(spy).body).toEqual({
      mesaId: "mesa-1",
      clienteNombre: "Familia Rojas",
      nroComensales: 2,
      fechaHora: "2026-10-29T20:00:00-05:00",
    });
  });
});

describe("updateReservation y estado", () => {
  it("manda solo los campos del cambio", async () => {
    const spy = mockFetch({ id: "rsv-1" });
    await updateReservation("rsv-1", { nroComensales: 6, mesaId: "mesa-2" });

    const { url, init, body } = callOf(spy);
    expect(url).toBe("/api/backend/reservations/rsv-1");
    expect(init.method).toBe("PATCH");
    expect(body).toEqual({ mesaId: "mesa-2", nroComensales: 6 });
  });

  it("avanza el estado con PATCH", async () => {
    const spy = mockFetch({ id: "rsv-1", estado: "CONFIRMADA" });
    await updateReservationStatus("rsv-1", "CONFIRMADA");

    const { url, init, body } = callOf(spy);
    expect(url).toBe("/api/backend/reservations/rsv-1/status");
    expect(init.method).toBe("PATCH");
    expect(body).toEqual({ estado: "CONFIRMADA" });
  });
});
