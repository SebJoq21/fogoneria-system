import { describe, expect, it } from "vitest";
import { movementQtyLabel, movementTypeLabel, type ApiMovement } from "./inventory-api";

const BASE: ApiMovement = {
  id: "m1",
  fecha: "2026-11-06T18:00:00.000Z",
  tipo: "SALIDA",
  insumoId: "i1",
  insumo: "Papa",
  unidad: "kg",
  cantidad: 2.5,
  stockResultante: 7.5,
  motivo: "Comanda ORD-000123",
  orden: "ORD-000123",
};

describe("inventory-api (AYCDS-24)", () => {
  it("etiqueta los tipos del kardex", () => {
    expect(movementTypeLabel("ENTRADA")).toBe("Entrada");
    expect(movementTypeLabel("SALIDA")).toBe("Salida");
    expect(movementTypeLabel("AJUSTE")).toBe("Ajuste");
    expect(movementTypeLabel("MERMA")).toBe("Merma");
  });

  it("la salida se muestra en negativo y la entrada en positivo", () => {
    expect(movementQtyLabel(BASE)).toBe("-2.5 kg");
    expect(movementQtyLabel({ ...BASE, tipo: "ENTRADA", cantidad: 4 })).toBe("+4 kg");
    expect(movementQtyLabel({ ...BASE, tipo: "AJUSTE", cantidad: 0.5 })).toBe("0.5 kg");
  });

  it("una salida sin motivo conserva la unidad vacía sin romper", () => {
    expect(movementQtyLabel({ ...BASE, tipo: "MERMA", cantidad: 1, unidad: "" })).toBe("-1");
  });
});
