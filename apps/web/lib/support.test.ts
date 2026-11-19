import { describe, expect, it } from "vitest";
import { SUPPORT_EMAIL, supportMailto } from "./support";

function queryOf(mailto: string): URLSearchParams {
  return new URL(mailto).searchParams;
}

describe("supportMailto", () => {
  it("sin email: asunto por defecto y cuerpo sin correo registrado", () => {
    const mailto = supportMailto();
    expect(mailto.startsWith(`mailto:${SUPPORT_EMAIL}?`)).toBe(true);

    const params = queryOf(mailto);
    expect(params.get("subject")).toBe("Recuperar contraseña");
    expect(params.get("body")).toContain("necesito recuperar la contraseña");
    expect(params.get("body")).not.toContain("Correo registrado");
    // RFC 6068: espacios percent-encoded, nunca `+`.
    expect(mailto).not.toContain("+");
  });

  it("con email: lo incluye codificado y el cliente lo recupera entero", () => {
    const email = "ana+pruebas@fogoneria.pe";
    const mailto = supportMailto({ email });

    expect(mailto).toContain("ana%2Bpruebas%40fogoneria.pe");
    const body = queryOf(mailto).get("body") ?? "";
    expect(body).toContain(`Correo registrado: ${email}`);
  });

  it("respeta un asunto personalizado", () => {
    const params = queryOf(supportMailto({ subject: "Acceso a mi cuenta" }));
    expect(params.get("subject")).toBe("Acceso a mi cuenta");
  });
});
