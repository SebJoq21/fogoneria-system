import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOKEN_COOKIE } from "@/lib/backend";
import { GET, POST } from "./route";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const context = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe("BFF /api/backend", () => {
  it("reenvía GET con el token de la cookie y sin cache", async () => {
    fetchMock.mockResolvedValue(
      new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const request = new NextRequest("http://localhost/api/backend/tenant/branches?x=1", {
      headers: { cookie: `${TOKEN_COOKIE}=jwt-123`, accept: "application/json" },
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
      headers: { origin: "http://evil.test", "content-type": "application/json" },
      body: JSON.stringify({ nombre: "x" }),
    });
    const response = await POST(request, context(["catalog", "dishes"]));

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("devuelve 502 si la API no responde", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const response = await GET(
      new NextRequest("http://localhost/api/backend/tenant"),
      context(["tenant"]),
    );
    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
