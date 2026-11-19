import { afterEach, describe, expect, it, vi } from "vitest";
import {
  branchStorageKey,
  clearSessionUser,
  parseSessionUser,
  storeSessionUser,
  tenantKeyOf,
} from "./session-state";
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

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

describe("persistencia de la sesión", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("guarda el usuario del shell como JSON", () => {
    const storage = fakeStorage();
    vi.stubGlobal("localStorage", storage);

    storeSessionUser(user);

    expect(parseSessionUser(storage.getItem("fogoneria:user"))).toEqual(user);
  });

  it("al limpiar borra usuario, sucursal de la empresa y cookies planas", () => {
    const storage = fakeStorage();
    const cookies: string[] = [];
    const doc = {};
    Object.defineProperty(doc, "cookie", {
      get: () => cookies.join("; "),
      set: (value: string) => {
        cookies.push(value);
      },
    });
    storage.setItem("fogoneria:user", JSON.stringify(user));
    storage.setItem(branchStorageKey("e-1"), "s-1");
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("document", doc);

    clearSessionUser(user);

    expect(storage.getItem("fogoneria:user")).toBeNull();
    expect(storage.getItem(branchStorageKey("e-1"))).toBeNull();
    expect(cookies).toEqual([
      "fogoneria.role=; path=/; max-age=0",
      "fogoneria.branch=; path=/; max-age=0",
    ]);
  });
});
