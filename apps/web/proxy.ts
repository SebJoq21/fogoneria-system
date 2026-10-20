import { SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { SESSION_COOKIE, signSession, verifySession } from "./session";

const SECRET = "unit-test-session-secret-32-characters-min";

beforeAll(() => {
  process.env.SESSION_SECRET = SECRET;
});

describe("session", () => {
  it("firma y verifica una sesión válida", async () => {
    const token = await signSession({ sub: "u-1", role: "admin", branchId: null });
    expect(token).not.toBe("");
    expect(SESSION_COOKIE).toBe("fogoneria.session");
    await expect(verifySession(token)).resolves.toEqual({
      sub: "u-1",
      role: "admin",
      branchId: null,
    });
  });

  it("conserva el rol y la sucursal", async () => {
    const token = await signSession({ sub: "u-2", role: "mesero", branchId: "miraflores" });
    await expect(verifySession(token)).resolves.toEqual({
      sub: "u-2",
      role: "mesero",
      branchId: "miraflores",
    });
  });

  it("acepta el rol cajero", async () => {
    const token = await signSession({ sub: "u-caja", role: "cajero", branchId: "miraflores" });
    await expect(verifySession(token)).resolves.toEqual({
      sub: "u-caja",
      role: "cajero",
      branchId: "miraflores",
    });
  });

  it("rechaza un token manipulado", async () => {
    const token = await signSession({ sub: "u-3", role: "admin", branchId: null });
    const tampered = `${token.slice(0, -2)}xx`;
    await expect(verifySession(tampered)).resolves.toBeNull();
  });

  it("rechaza un token expirado", async () => {
    const token = await signSession({ sub: "u-4", role: "admin", branchId: null }, -1);
    await expect(verifySession(token)).resolves.toBeNull();
  });

  it("rechaza cookies vacías o ausentes", async () => {
    await expect(verifySession(undefined)).resolves.toBeNull();
    await expect(verifySession("")).resolves.toBeNull();
  });

  it("rechaza un rol fuera del catálogo aunque la firma sea válida", async () => {
    const token = await new SignJWT({ role: "root", branchId: null })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u-5")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(SECRET));
    await expect(verifySession(token)).resolves.toBeNull();
  });
});

import { NextResponse, type NextRequest } from "next/server";
import { ROLE_HOME, canViewPath, type AppRole } from "./lib/auth";

const VALID_ROLES: AppRole[] = [
  "superadmin",
  "admin",
  "sucursal",
  "cajero",
  "cocina",
  "mesero",
];

/**
 * RBAC optimista (fase mocks): lee rol/branch de cookies planas que fija el
 * login. Sin DB aquí por rendimiento (patrón doc oficial Next.js Proxy).
 * La API real (fase 3) revalida JWT + tenant en cada request.
 */
export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const role = req.cookies.get("fogoneria.role")?.value as AppRole | undefined;
  const authed = !!role && VALID_ROLES.includes(role);

  // `/` es el login: si ya hay sesión, manda al home por rol.
  if (path === "/") {
    if (authed) {
      return NextResponse.redirect(new URL(ROLE_HOME[role], req.url));
    }
    return NextResponse.next();
  }

  if (!authed) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (!canViewPath(path, role)) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/app/:path*", "/saas/:path*"],
};
