import { describe, expect, it } from "vitest";
import {
  calcularMargen,
  DIAS_VISTA_BI,
  etiquetaMetodoPago,
  type ReporteBi,
} from "@fogoneria/contracts/bi";
import { diaCorto, diaLima } from "@fogoneria/kernel";
import { itemsDe, rangoVista } from "./api";

describe("rango de la vista BI", () => {
  it("usa el día de Lima con offset fijo", () => {
    // 2026-11-11 02:00 UTC = 2026-11-10 21:00 en Lima.
    expect(diaLima(new Date("2026-11-11T02:00:00.000Z"))).toBe("2026-11-10");
  });

  it("arranca en 7 días e incluye hoy", () => {
    const rango = rangoVista(DIAS_VISTA_BI, new Date("2026-11-10T15:00:00.000Z"));

    expect(rango).toEqual({ desde: "2026-11-04", hasta: "2026-11-10" });
  });

  it("abrevia el día para el gráfico", () => {
    expect(diaCorto("2026-11-10")).toBe("Mar");
    expect(diaCorto("2026-11-08")).toBe("Dom");
  });
});

describe("mapeo de reportes", () => {
  it("extrae la lista de un reporte con items", () => {
    const reporte: ReporteBi<{ fecha: string }> = {
      desde: "2026-11-04",
      hasta: "2026-11-10",
      sucursalId: null,
      items: [{ fecha: "2026-11-10" }],
    };

    expect(itemsDe(reporte)).toEqual([{ fecha: "2026-11-10" }]);
  });

  it("una respuesta vacía se lee como lista vacía", () => {
    expect(itemsDe(undefined)).toEqual([]);
    expect(itemsDe(null)).toEqual([]);
  });
});

describe("margen y etiquetas", () => {
  it("el margen es ventas - gastos con 2 decimales", () => {
    expect(calcularMargen(288, 600)).toBe(-312);
    expect(calcularMargen(10.005, 0)).toBe(10.01);
  });

  it("traduce el método de pago y respeta uno desconocido", () => {
    expect(etiquetaMetodoPago("EFECTIVO")).toBe("Efectivo");
    expect(etiquetaMetodoPago("yape")).toBe("Yape");
    expect(etiquetaMetodoPago("CRIPTO")).toBe("CRIPTO");
  });
});
