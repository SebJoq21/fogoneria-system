import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/session/logout", () => {
  it("borra las cookies HttpOnly y redirige al login", async () => {
    const response = await GET();
    expect(response.status).toBe(303);
    // Relativo: en Next standalone `request.url` usa HOSTNAME (0.0.0.0 en Docker).
    expect(response.headers.get("location")).toBe("/");
    expect(response.headers.get("cache-control")).toBe("no-store");

    const cookies = response.headers.getSetCookie().join("\n");
    expect(cookies).toContain("fogoneria.session=");
    expect(cookies).toContain("fogoneria.token=");
    expect(cookies).toContain("Expires=Thu, 01 Jan 1970");
  });
});
