import { describe, expect, it } from "vitest";
import { createDeduper, realtimeBaseUrl } from "./realtime";

describe("realtimeBaseUrl", () => {
  it("quita el prefijo /api/v1 de la URL de la API", () => {
    expect(realtimeBaseUrl("http://localhost:3001/api/v1")).toBe("http://localhost:3001");
    expect(realtimeBaseUrl("https://api.fogoneria.pe/api/v1/")).toBe(
      "https://api.fogoneria.pe",
    );
  });

  it("no toca una URL que ya es la base", () => {
    expect(realtimeBaseUrl("http://localhost:3001")).toBe("http://localhost:3001");
  });
});

describe("createDeduper", () => {
  it("descarta un eventId repetido", () => {
    const isFresh = createDeduper();
    expect(isFresh("a")).toBe(true);
    expect(isFresh("a")).toBe(false);
    expect(isFresh("b")).toBe(true);
  });

  it("respeta el límite y olvida los más viejos", () => {
    const isFresh = createDeduper(2);
    expect(isFresh("a")).toBe(true);
    expect(isFresh("b")).toBe(true);
    expect(isFresh("c")).toBe(true);
    // "a" ya salió de la ventana: se acepta otra vez.
    expect(isFresh("a")).toBe(true);
  });

  it("acepta eventos sin eventId (servidor viejo)", () => {
    const isFresh = createDeduper();
    expect(isFresh("")).toBe(true);
  });
});
