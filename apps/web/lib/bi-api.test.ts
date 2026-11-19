import { describe, expect, it } from "vitest";
import { diaCorto, diaLima, ultimosDias } from "./bi-api";

describe("bi-api", () => {
  it("calcula el día de Lima con offset fijo", () => {
    // 2026-11-11 02:00 UTC = 2026-11-10 21:00 en Lima.
    expect(diaLima(new Date("2026-11-11T02:00:00.000Z"))).toBe("2026-11-10");
  });

  it("el rango de 7 días incluye hoy", () => {
    const rango = ultimosDias(7, new Date("2026-11-10T15:00:00.000Z"));

    expect(rango).toEqual({ desde: "2026-11-04", hasta: "2026-11-10" });
  });

  it("un solo día devuelve desde = hasta", () => {
    const rango = ultimosDias(1, new Date("2026-11-10T15:00:00.000Z"));

    expect(rango.desde).toBe("2026-11-10");
    expect(rango.hasta).toBe("2026-11-10");
  });

  it("abrevia el día para el gráfico", () => {
    expect(diaCorto("2026-11-10")).toBe("Mar");
    expect(diaCorto("2026-11-08")).toBe("Dom");
  });
});
