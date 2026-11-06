import { afterEach, describe, expect, it, vi } from "vitest";
import { tokenCookieOptions } from "./backend";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("tokenCookieOptions", () => {
  it("es Secure por defecto en producción", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(tokenCookieOptions().secure).toBe(true);
  });

  it("respeta SESSION_COOKIE_SECURE=false en producción (Compose por HTTP)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_COOKIE_SECURE", "false");
    expect(tokenCookieOptions().secure).toBe(false);
  });

  it("respeta SESSION_COOKIE_SECURE=true y no es Secure fuera de producción", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SESSION_COOKIE_SECURE", "true");
    expect(tokenCookieOptions().secure).toBe(true);

    vi.stubEnv("SESSION_COOKIE_SECURE", "");
    expect(tokenCookieOptions().secure).toBe(false);
  });
});
