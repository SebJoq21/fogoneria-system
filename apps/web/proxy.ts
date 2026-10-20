import { SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { SESSION_COOKIE, signSession, verifySession } from "./session";

const SECRET = "unit-test-session-secret-32-characters-min";

beforeAll(() => {
  process.env.SESSION_SECRET = SECRET;
});

describe("session", () => {
  it("firma y verifica una sesión válida", async () => {
    const token = await signSession({ sub: "u-1", role: "admin", branchId: null });
    expect(token).not.toBe("");
    expect(SESSION_COOKIE).toBe("fogoneria.session");
    await expect(verifySession(token)).resolves.toEqual({
      sub: "u-1",
      role: "admin",
      branchId: null,
    });
  });

  it("conserva el rol y la sucursal", async () => {
    const token = await signSession({ sub: "u-2", role: "mesero", branchId: "miraflores" });
    await expect(verifySession(token)).resolves.toEqual({
      sub: "u-2",
      role: "mesero",
      branchId: "miraflores",
    });
  });

  it("acepta el rol cajero", async () => {
    const token = await signSession({ sub: "u-caja", role: "cajero", branchId: "miraflores" });
    await expect(verifySession(token)).resolves.toEqual({
      sub: "u-caja",
      role: "cajero",
      branchId: "miraflores",
    });
  });

  it("rechaza un token manipulado", async () => {
    const token = await signSession({ sub: "u-3", role: "admin", branchId: null });
    const tampered = `${token.slice(0, -2)}xx`;
    await expect(verifySession(tampered)).resolves.toBeNull();
  });

  it("rechaza un token expirado", async () => {
    const token = await signSession({ sub: "u-4", role: "admin", branchId: null }, -1);
    await expect(verifySession(token)).resolves.toBeNull();
  });

  it("rechaza cookies vacías o ausentes", async () => {
    await expect(verifySession(undefined)).resolves.toBeNull();
    await expect(verifySession("")).resolves.toBeNull();
  });

  it("rechaza un rol fuera del catálogo aunque la firma sea válida", async () => {
    const token = await new SignJWT({ role: "root", branchId: null })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u-5")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(SECRET));
    await expect(verifySession(token)).resolves.toBeNull();
  });
});

