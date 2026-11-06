import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOKEN_COOKIE } from "@/lib/backend";
import { SESSION_COOKIE, signSession } from "@/lib/session";
import { GET } from "./route";

const fetchMock = vi.fn();
const SECRET = "test-session-secret-with-32-characters!!";

async function sessionCookie(): Promise<string> {
  return signSession({
    sub: "u-1",
    role: "cocina",
    branchId: "s-1",
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

function requestWith(cookie?: string) {
  return new NextRequest("http://localhost/api/session/ws-ticket", {
    headers: cookie ? { cookie } : {},
  });
}

describe("GET /api/session/ws-ticket", () => {
  it("rechaza sin sesión firmada y no llama a la API", async () => {
    const response = await GET(requestWith(`${TOKEN_COOKIE}=jwt-123`));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("pide el ticket a la API con el Bearer de la cookie", async () => {
    fetchMock.mockResolvedValue(
      new Response('{"ticket":"ws-ticket-1","expiresIn":60}', {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const response = await GET(
      requestWith(`${SESSION_COOKIE}=${await sessionCookie()}; ${TOKEN_COOKIE}=jwt-123`),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ticket: "ws-ticket-1", expiresIn: 60 });
    expect(response.headers.get("cache-control")).toBe("no-store");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/api/v1/auth/ws-ticket");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer jwt-123");
  });

  it("devuelve 502 si la API responde con error", async () => {
    fetchMock.mockResolvedValue(new Response('{"message":"boom"}', { status: 500 }));
    const response = await GET(
      requestWith(`${SESSION_COOKIE}=${await sessionCookie()}; ${TOKEN_COOKIE}=jwt-123`),
    );

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("devuelve 502 si la API devuelve una respuesta sin ticket", async () => {
    fetchMock.mockResolvedValue(
      new Response('{"expiresIn":60}', {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const response = await GET(
      requestWith(`${SESSION_COOKIE}=${await sessionCookie()}; ${TOKEN_COOKIE}=jwt-123`),
    );

    expect(response.status).toBe(502);
  });

  it("propaga 401 cuando el access token ya no sirve", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));
    const response = await GET(
      requestWith(`${SESSION_COOKIE}=${await sessionCookie()}; ${TOKEN_COOKIE}=viejo`),
    );

    expect(response.status).toBe(401);
  });

  it("devuelve 502 si la API no responde", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const response = await GET(
      requestWith(`${SESSION_COOKIE}=${await sessionCookie()}; ${TOKEN_COOKIE}=jwt-123`),
    );

    expect(response.status).toBe(502);
  });
});
