import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTable,
  deleteTable,
  listTables,
  updateTable,
  updateTableStatus,
} from "./tables-api";

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

describe("listTables", () => {
  it("arma la query con estado, zona y sucursal", async () => {
    const spy = mockFetch([]);
    await listTables({ estado: "LIBRE", zona: "Salón", sucursalId: "suc-1" });

    const { url, init } = callOf(spy);
    expect(url).toBe("/api/backend/tables?estado=LIBRE&zona=Sal%C3%B3n&sucursalId=suc-1");
    expect(init.method).toBe("GET");
  });

  it("sin filtros llama al listado base", async () => {
    const spy = mockFetch([]);
    await listTables();
    expect(callOf(spy).url).toBe("/api/backend/tables");
  });
});

describe("mutaciones de mesa", () => {
  it("crea con numero, capacidad, zona y forma", async () => {
    const spy = mockFetch({ id: "mesa-1" });
    await createTable({ numero: "12", capacidad: 4, zona: "Terraza", forma: "REDONDA" });

    const { url, init, body } = callOf(spy);
    expect(url).toBe("/api/backend/tables");
    expect(init.method).toBe("POST");
    expect(body).toEqual({
      numero: "12",
      capacidad: 4,
      zona: "Terraza",
      forma: "REDONDA",
    });
  });

  it("actualiza solo los campos enviados", async () => {
    const spy = mockFetch({ id: "mesa-1" });
    await updateTable("mesa-1", { capacidad: 6 });

    const { url, init, body } = callOf(spy);
    expect(url).toBe("/api/backend/tables/mesa-1");
    expect(init.method).toBe("PATCH");
    expect(body).toEqual({ capacidad: 6 });
  });

  it("bloquea con MANTENIMIENTO y libera con LIBRE", async () => {
    const spy = mockFetch({ id: "mesa-1" });
    await updateTableStatus("mesa-1", "MANTENIMIENTO");
    await updateTableStatus("mesa-1", "LIBRE");

    expect(callOf(spy, 0).body).toEqual({ estado: "MANTENIMIENTO" });
    expect(callOf(spy, 1).body).toEqual({ estado: "LIBRE" });
    expect(callOf(spy, 0).url).toBe("/api/backend/tables/mesa-1/status");
  });

  it("da de baja con DELETE", async () => {
    const spy = mockFetch({ id: "mesa-1" });
    await deleteTable("mesa-1");

    const { url, init } = callOf(spy);
    expect(url).toBe("/api/backend/tables/mesa-1");
    expect(init.method).toBe("DELETE");
  });
});
