import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";
import { SESSION_COOKIE, signSession } from "./lib/session";
import proxy from "./proxy";

const SECRET = "proxy-test-session-secret-32-characters";

beforeAll(() => {
  process.env.SESSION_SECRET = SECRET;
});

async function token(role: "admin" | "mesero", ttl = 900): Promise<string> {
  return signSession(
    {
      sub: "u-1",
      role,
      branchId: role === "mesero" ? "s-1" : null,
      startedAt: Math.floor(Date.now() / 1000),
    },
    ttl,
  );
}

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

describe("proxy", () => {
  it("redirige al login si no hay cookie de sesión", async () => {
    const response = await proxy(request("/app/productos"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("permite el home del rol y refresca la cookie", async () => {
    const response = await proxy(request("/app", `${SESSION_COOKIE}=${await token("admin")}`));
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie().join(";")).toContain(SESSION_COOKIE);
  });

  it("redirige a la ruta de otro rol", async () => {
    const response = await proxy(
      request("/app/productos", `${SESSION_COOKIE}=${await token("mesero")}`),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/app/mozo");
  });

  it("rechaza una cookie expirada", async () => {
    const response = await proxy(
      request("/app", `${SESSION_COOKIE}=${await token("admin", -1)}`),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("rechaza una cookie manipulada", async () => {
    const value = await token("admin");
    const response = await proxy(
      request("/app", `${SESSION_COOKIE}=${value.slice(0, -2)}xx`),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("con sesión válida, el login redirige al home por rol", async () => {
    const response = await proxy(request("/", `${SESSION_COOKIE}=${await token("admin")}`));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/app");
  });
});
