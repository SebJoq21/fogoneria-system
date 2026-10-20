import { describe, expect, it } from "vitest";
import { ROLE_HOME, appUserFromApi, canViewPath, type AppRole } from "./auth";

const ROLES: AppRole[] = ["superadmin", "admin", "sucursal", "cajero", "cocina", "mesero"];

describe("canViewPath", () => {
  it("superadmin solo entra a /saas", () => {
    expect(canViewPath("/saas", "superadmin")).toBe(true);
    expect(canViewPath("/app", "superadmin")).toBe(false);
    expect(canViewPath("/app/cocina", "superadmin")).toBe(false);
  });

  it("admin opera /app pero no /saas ni los paneles de rol", () => {
    expect(canViewPath("/app", "admin")).toBe(true);
    expect(canViewPath("/app/productos", "admin")).toBe(true);
    expect(canViewPath("/saas", "admin")).toBe(false);
    expect(canViewPath("/app/cocina", "admin")).toBe(false);
    expect(canViewPath("/app/mozo", "admin")).toBe(false);
    expect(canViewPath("/app/mesas/maestro", "admin")).toBe(false);
  });

  it("sucursal opera /app y el maestro de mesas", () => {
    expect(canViewPath("/app", "sucursal")).toBe(true);
    expect(canViewPath("/app/mesas/maestro", "sucursal")).toBe(true);
    expect(canViewPath("/saas", "sucursal")).toBe(false);
    expect(canViewPath("/app/cocina", "sucursal")).toBe(false);
  });

  it("cajero solo ve /app, caja y comprobantes", () => {
    expect(canViewPath("/app", "cajero")).toBe(true);
    expect(canViewPath("/app/caja", "cajero")).toBe(true);
    expect(canViewPath("/app/comprobantes", "cajero")).toBe(true);
    expect(canViewPath("/app/productos", "cajero")).toBe(false);
    expect(canViewPath("/app/mesas/maestro", "cajero")).toBe(false);
    expect(canViewPath("/saas", "cajero")).toBe(false);
  });

  it("cocina solo ve su KDS", () => {
    expect(canViewPath("/app/cocina", "cocina")).toBe(true);
    expect(canViewPath("/app", "cocina")).toBe(false);
    expect(canViewPath("/app/mozo", "cocina")).toBe(false);
    expect(canViewPath("/app/productos", "cocina")).toBe(false);
  });

  it("mesero solo ve su panel", () => {
    expect(canViewPath("/app/mozo", "mesero")).toBe(true);
    expect(canViewPath("/app", "mesero")).toBe(false);
    expect(canViewPath("/app/cocina", "mesero")).toBe(false);
    expect(canViewPath("/saas", "mesero")).toBe(false);
  });

  it("cada rol tiene un home válido según su matriz", () => {
    for (const role of ROLES) {
      expect(ROLE_HOME[role]).toMatch(/^\/(app|saas)/);
      expect(canViewPath(ROLE_HOME[role], role)).toBe(true);
    }
  });
});

describe("appUserFromApi", () => {
  const base = {
    id: "u-1",
    nombre: "Ana Beltrán",
    email: "ana@fogoneria.com",
    empresaId: "e-1",
  };

  it("mapea el rol real y la sucursal", () => {
    expect(
      appUserFromApi({ ...base, rol: "CAJERO", sucursalId: "s-1" }),
    ).toMatchObject({ role: "cajero", branchId: "s-1" });
  });

  it("admin no queda atado a una sucursal", () => {
    expect(
      appUserFromApi({ ...base, rol: "ADMIN_GLOBAL", sucursalId: null }),
    ).toMatchObject({ role: "admin", branchId: null });
  });

  it("rechaza roles desconocidos en vez de asumir mesero", () => {
    expect(appUserFromApi({ ...base, rol: "ROOT", sucursalId: "s-1" })).toBeNull();
  });

  it("rechaza roles operativos sin sucursal en vez de caer a 'todas'", () => {
    expect(appUserFromApi({ ...base, rol: "MESERO", sucursalId: null })).toBeNull();
    expect(appUserFromApi({ ...base, rol: "CAJERO", sucursalId: null })).toBeNull();
  });
});
