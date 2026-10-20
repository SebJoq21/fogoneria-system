import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/session/logout", () => {
  it("borra las cookies HttpOnly y redirige al login", async () => {
    const response = await GET(new NextRequest("http://localhost/api/session/logout"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/");
    expect(response.headers.get("cache-control")).toBe("no-store");

    const cookies = response.headers.getSetCookie().join("\n");
    expect(cookies).toContain("fogoneria.session=");
    expect(cookies).toContain("fogoneria.token=");
    expect(cookies).toContain("Expires=Thu, 01 Jan 1970");
  });
});
