import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("./api", () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));

import { adjustPoints, lastVisitLabel, listCustomers, segmentLabel } from "./crm-api";

describe("crm-api (AYCDS-40)", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue({ items: [], total: 0, page: 1, limit: 100 });
  });

  it("traduce el segmento de la API a la etiqueta del ERP", () => {
    expect(segmentLabel("NUEVO")).toBe("Nuevo");
    expect(segmentLabel("FRECUENTE")).toBe("Frecuente");
    expect(segmentLabel("VIP")).toBe("VIP");
  });

  it("la última visita se muestra dd/mm/aaaa o guion", () => {
    expect(lastVisitLabel("2026-11-06")).toBe("06/11/2026");
    expect(lastVisitLabel("2026-11-06T13:00:00.000Z")).toBe("06/11/2026");
    expect(lastVisitLabel(null)).toBe("—");
  });

  it("arma la query de búsqueda y segmento", async () => {
    await listCustomers({ q: "Rosa", segmento: "VIP", limit: 20 });

    expect(apiFetch).toHaveBeenCalledWith("/crm/customers?q=Rosa&segmento=VIP&limit=20", {
      signal: undefined,
    });
  });

  it("sin filtros no agrega query", async () => {
    await listCustomers();

    expect(apiFetch).toHaveBeenCalledWith("/crm/customers", { signal: undefined });
  });

  it("el ajuste de puntos manda tipo, puntos y motivo", async () => {
    apiFetch.mockResolvedValue({ id: "m1" });

    await adjustPoints("c1", { tipo: "GANANCIA", puntos: 50, motivo: "Cortesía" });

    expect(apiFetch).toHaveBeenCalledWith("/crm/customers/c1/points", {
      method: "POST",
      body: { tipo: "GANANCIA", puntos: 50, motivo: "Cortesía" },
    });
  });
});
