import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOKEN_COOKIE } from "@/lib/backend";
import { SESSION_COOKIE, signSession } from "@/lib/session";
import { GET, POST } from "./route";

const fetchMock = vi.fn();
const SECRET = "test-session-secret-with-32-characters!!";

async function sessionCookie(): Promise<string> {
  return signSession({
    sub: "u-1",
    role: "admin",
    branchId: null,
    startedAt: Math.floor(Date.now() / 1000),
  });
}

beforeEach(() => {
  process.env.SESSION_SECRET = SECRET;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const context = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe("BFF /api/backend", () => {
  it("rechaza sin sesión firmada aunque exista el token", async () => {
    const request = new NextRequest("http://localhost/api/backend/tenant", {
      headers: { cookie: `${TOKEN_COOKIE}=jwt-123` },
    });
    const response = await GET(request, context(["tenant"]));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reenvía GET con el token de la cookie y sin cache", async () => {
    fetchMock.mockResolvedValue(
      new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const request = new NextRequest("http://localhost/api/backend/tenant/branches?x=1", {
      headers: {
        cookie: `${SESSION_COOKIE}=${await sessionCookie()}; ${TOKEN_COOKIE}=jwt-123`,
        accept: "application/json",
      },
    });
    const response = await GET(request, context(["tenant", "branches"]));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("http://localhost:3001/api/v1/tenant/branches?x=1");
    expect((init.headers as Headers).get("authorization")).toBe("Bearer jwt-123");
  });

  it("bloquea mutaciones con Origin ajeno", async () => {
    const request = new NextRequest("http://localhost/api/backend/catalog/dishes", {
      method: "POST",
      headers: {
        origin: "http://evil.test",
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${await sessionCookie()}`,
      },
      body: JSON.stringify({ nombre: "x" }),
    });
    const response = await POST(request, context(["catalog", "dishes"]));

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("devuelve 502 si la API no responde", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const response = await GET(
      new NextRequest("http://localhost/api/backend/tenant", {
        headers: { cookie: `${SESSION_COOKIE}=${await sessionCookie()}` },
      }),
      context(["tenant"]),
    );
    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
