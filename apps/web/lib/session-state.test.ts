import { describe, expect, it } from "vitest";
import { branchStorageKey, parseSessionUser, tenantKeyOf } from "./session-state";
import type { AppUser } from "./auth";

const user: AppUser = {
  id: "u-1",
  name: "Ana Beltrán",
  email: "ana@fogoneria.com",
  role: "mesero",
  empresaId: "e-1",
  branchId: "s-1",
  initials: "AB",
};

describe("parseSessionUser", () => {
  it("recupera el usuario persistido", () => {
    expect(parseSessionUser(JSON.stringify(user))).toEqual(user);
  });

  it("devuelve null sin dato o con JSON inválido", () => {
    expect(parseSessionUser(null)).toBeNull();
    expect(parseSessionUser("{no-es-json")).toBeNull();
  });

  it("rechaza payloads sin id o rol en vez de pintar un usuario a medias", () => {
    expect(parseSessionUser(JSON.stringify({ ...user, id: "" }))).toBeNull();
    expect(parseSessionUser(JSON.stringify({ ...user, role: "" }))).toBeNull();
  });
});

describe("namespace de sesión", () => {
  it("la sucursal se recuerda por empresa", () => {
    expect(branchStorageKey("e-1")).toBe("fogoneria:branch:e-1");
    expect(branchStorageKey("e-2")).not.toBe(branchStorageKey("e-1"));
  });

  it("sin empresa cae al namespace anónimo", () => {
    expect(tenantKeyOf(null)).toBe("anon");
    expect(tenantKeyOf({ ...user, empresaId: null })).toBe("anon");
    expect(tenantKeyOf(user)).toBe("e-1");
  });
});
