import { describe, expect, it } from "vitest";
import { nextSku } from "./catalog-sku";

describe("nextSku", () => {
  it("toma el mayor sufijo numérico", () => {
    expect(nextSku([{ sku: "PLA-002" }, { sku: "PLA-010" }, { sku: "PLA-007" }])).toBe("PLA-011");
  });

  it("ignora SKUs sin sufijo y lista vacía", () => {
    expect(nextSku([{ sku: "PLA" }])).toBe("PLA-001");
    expect(nextSku([])).toBe("PLA-001");
  });
});
