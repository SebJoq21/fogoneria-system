import { afterEach, describe, expect, it, vi } from "vitest";
import { createOrder, listOrders, updateOrderStatus } from "./orders-api";

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

describe("listOrders", () => {
  it("arma la query con estado, sucursal y mesa", async () => {
    const spy = mockFetch({ items: [], total: 0 });

    await listOrders({
      estado: "EN_COCINA",
      sucursalId: "suc-1",
      mesaId: "mesa-1",
      page: 2,
      limit: 50,
    });

    const { url, init } = callOf(spy);
    expect(url).toBe(
      "/api/backend/orders?estado=EN_COCINA&sucursalId=suc-1&mesaId=mesa-1&page=2&limit=50",
    );
    expect(init.method).toBe("GET");
  });

  it("sin filtros llama al listado base", async () => {
    const spy = mockFetch({ items: [], total: 0 });
    await listOrders();
    expect(callOf(spy).url).toBe("/api/backend/orders");
  });
});

describe("createOrder", () => {
  it("envía líneas sin precio: el importe lo resuelve el servidor", async () => {
    const spy = mockFetch({ id: "orden-1", numero_orden: "ORD-000001" });

    await createOrder({
      mesaId: "mesa-1",
      origen: "MESA",
      items: [
        {
          tipo: "PLATO",
          platoId: "plato-1",
          cantidad: 2,
          notas: "Sin cebolla",
        },
      ],
    });

    const { url, init, body } = callOf(spy);
    expect(url).toBe("/api/backend/orders");
    expect(init.method).toBe("POST");
    expect(body).toEqual({
      mesaId: "mesa-1",
      origen: "MESA",
      items: [{ tipo: "PLATO", platoId: "plato-1", cantidad: 2, notas: "Sin cebolla" }],
    });
    expect(JSON.stringify(body)).not.toContain("precioUnitario");
  });

  it("no manda campos vacíos", async () => {
    const spy = mockFetch({ id: "orden-1" });
    await createOrder({ items: [{ tipo: "PLATO", platoId: "plato-1", cantidad: 1 }] });

    const { body } = callOf(spy);
    expect(body).toEqual({
      items: [{ tipo: "PLATO", platoId: "plato-1", cantidad: 1 }],
    });
  });
});

describe("updateOrderStatus", () => {
  it("hace PATCH del estado", async () => {
    const spy = mockFetch({ id: "orden-1", estado: "LISTO" });
    await updateOrderStatus("orden-1", "LISTO");

    const { url, init, body } = callOf(spy);
    expect(url).toBe("/api/backend/orders/orden-1/status");
    expect(init.method).toBe("PATCH");
    expect(body).toEqual({ estado: "LISTO" });
  });
});
