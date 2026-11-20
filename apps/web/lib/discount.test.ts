import { describe, expect, it } from "vitest";
import { parseCouponDiscount } from "./discount";

describe("parseCouponDiscount", () => {
  it("aplica porcentajes enteros y decimales", () => {
    expect(parseCouponDiscount({ discount: "10% OFF" }, 100)).toBe(10);
    expect(parseCouponDiscount({ discount: "15.5 % OFF" }, 200)).toBe(31);
  });

  it("aplica monto fijo sin superar la base", () => {
    expect(parseCouponDiscount({ discount: "$5.00 Descuento" }, 100)).toBe(5);
    expect(parseCouponDiscount({ discount: "$500 Descuento" }, 100)).toBe(100);
  });

  it("devuelve 0 cuando no hay descuento parseable", () => {
    expect(parseCouponDiscount({ discount: "SIN DESCUENTO" }, 100)).toBe(0);
    expect(parseCouponDiscount({ discount: "%" }, 100)).toBe(0);
    expect(parseCouponDiscount({ discount: "$" }, 100)).toBe(0);
  });
});
