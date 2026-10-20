import { describe, expect, it } from "vitest";
import { ROLE_HOME, canViewPath, type AppRole } from "./auth";

const ROLES: AppRole[] = ["superadmin", "admin", "sucursal", "cocina", "mesero"];

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
