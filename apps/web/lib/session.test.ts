import { SignJWT } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  SESSION_ABSOLUTE_MAX_SECONDS,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
  signSession,
  verifySession,
} from "./session";

const SECRET = "unit-test-session-secret-32-characters-min";
const DEV_SECRET = "dev-only-session-secret-change-me-32chars";

function tokenWith(payload: Record<string, unknown>, secret = SECRET): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("u-test")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
}

beforeAll(() => {
  process.env.SESSION_SECRET = SECRET;
});

afterEach(() => {
  vi.unstubAllEnvs();
  process.env.SESSION_SECRET = SECRET;
});

describe("session", () => {
  it("firma y verifica una sesión válida", async () => {
    const startedAt = Math.floor(Date.now() / 1000);
    const token = await signSession({ sub: "u-1", role: "admin", branchId: null, startedAt });
    expect(token).not.toBe("");
    expect(SESSION_COOKIE).toBe("fogoneria.session");
    expect(SESSION_MAX_AGE_SECONDS).toBe(15 * 60);
    await expect(verifySession(token)).resolves.toEqual({
      sub: "u-1",
      role: "admin",
      branchId: null,
      startedAt,
    });
  });

  it("conserva el rol cajero y la sucursal", async () => {
    const startedAt = Math.floor(Date.now() / 1000);
    const token = await signSession({ sub: "u-2", role: "cajero", branchId: "miraflores", startedAt });
    await expect(verifySession(token)).resolves.toEqual({
      sub: "u-2",
      role: "cajero",
      branchId: "miraflores",
      startedAt,
    });
  });

  it("rechaza un token manipulado", async () => {
    const startedAt = Math.floor(Date.now() / 1000);
    const token = await signSession({ sub: "u-3", role: "admin", branchId: null, startedAt });
    const tampered = `${token.slice(0, -2)}xx`;
    await expect(verifySession(tampered)).resolves.toBeNull();
  });

  it("rechaza un token expirado", async () => {
    const startedAt = Math.floor(Date.now() / 1000);
    const token = await signSession({ sub: "u-4", role: "admin", branchId: null, startedAt }, -1);
    await expect(verifySession(token)).resolves.toBeNull();
  });

  it("rechaza una sesión que superó el tope absoluto", async () => {
    const startedAt = Math.floor(Date.now() / 1000) - SESSION_ABSOLUTE_MAX_SECONDS - 1;
    const token = await signSession({ sub: "u-6", role: "admin", branchId: null, startedAt });
    await expect(verifySession(token)).resolves.toBeNull();
  });

  it("permite desactivar Secure para HTTP local en producción", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_COOKIE_SECURE", "false");
    expect(sessionCookieOptions().secure).toBe(false);
    vi.stubEnv("SESSION_COOKIE_SECURE", "true");
    expect(sessionCookieOptions().secure).toBe(true);
  });

  it("rechaza cookies vacías o ausentes", async () => {
    await expect(verifySession(undefined)).resolves.toBeNull();
    await expect(verifySession("")).resolves.toBeNull();
  });

  it("rechaza un rol fuera del catálogo aunque la firma sea válida", async () => {
    const token = await tokenWith({
      role: "root",
      branchId: null,
      startedAt: Math.floor(Date.now() / 1000),
    });
    await expect(verifySession(token)).resolves.toBeNull();
  });

  it("rechaza una firma hecha con el secreto de desarrollo fuera de dev/test", async () => {
    const token = await tokenWith(
      { role: "admin", branchId: null, startedAt: Math.floor(Date.now() / 1000) },
      DEV_SECRET,
    );
    vi.stubEnv("NODE_ENV", "production");
    process.env.SESSION_SECRET = "";
    await expect(verifySession(token)).resolves.toBeNull();
  });

  it("no firma en producción sin SESSION_SECRET", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.SESSION_SECRET = "";
    await expect(
      signSession({
        sub: "u-7",
        role: "admin",
        branchId: null,
        startedAt: Math.floor(Date.now() / 1000),
      }),
    ).rejects.toThrow(/SESSION_SECRET/);
  });
});
