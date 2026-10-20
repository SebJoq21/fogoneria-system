import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";

vi.mock("@/lib/auth-api", () => ({
  loginRequest: vi.fn(),
}));

import { loginRequest } from "@/lib/auth-api";
import { resetSessionRateLimit } from "@/lib/session-rate-limit";
import { POST } from "./route";

const SECRET = "session-route-test-secret-32-characters-min";
const mockedLogin = vi.mocked(loginRequest);

function loginRequestWith(body: unknown, ip = "10.0.0.1"): Request {
  return new Request("http://localhost/api/session", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.SESSION_SECRET = SECRET;
  resetSessionRateLimit();
  mockedLogin.mockReset();
});

describe("POST /api/session", () => {
  it("emite las cookies HttpOnly y no devuelve el access token", async () => {
    mockedLogin.mockResolvedValue({
      user: {
        id: "u-1",
        name: "Ana Beltrán",
        email: "ana@fogoneria.com",
        role: "admin",
        branchId: null,
        initials: "AB",
      },
      tenant: null,
      accessToken: "jwt-secreto",
    });

    const response = await POST(
      loginRequestWith({ email: "ana@fogoneria.com", password: "Fogoneria123!" }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const body = await response.json();
    expect(body).toEqual({
      user: expect.objectContaining({ id: "u-1", role: "admin" }),
    });
    expect(JSON.stringify(body)).not.toContain("jwt-secreto");

    const cookies = response.headers.getSetCookie().join("\n");
    expect(cookies).toContain("fogoneria.session=");
    expect(cookies).toContain("fogoneria.token=jwt-secreto");
    expect(cookies).toContain("HttpOnly");
    expect(cookies).toContain("SameSite=lax");
    expect(cookies).toContain("Max-Age=900");
  });

  it("rechaza credenciales inválidas con el status de la API", async () => {
    mockedLogin.mockRejectedValue(new ApiError("Correo o contraseña incorrectos.", 401));
    const response = await POST(
      loginRequestWith({ email: "ana@fogoneria.com", password: "mala" }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("corta la fuerza bruta con 429", async () => {
    mockedLogin.mockRejectedValue(new ApiError("Correo o contraseña incorrectos.", 401));
    let response: Response | undefined;
    for (let i = 0; i < 6; i += 1) {
      response = await POST(
        loginRequestWith({ email: "ana@fogoneria.com", password: "mala" }, "10.0.0.2"),
      );
    }
    expect(response?.status).toBe(429);
    expect(response?.headers.get("retry-after")).toBeTruthy();
  });

  it("rechaza un body sin credenciales", async () => {
    const response = await POST(loginRequestWith({}));
    expect(response.status).toBe(400);
  });
});
