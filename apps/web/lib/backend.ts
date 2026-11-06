/* Constantes del BFF (solo servidor): el access token de la API vive en una
   cookie HttpOnly y el navegador nunca lo ve. */

export const TOKEN_COOKIE = "fogoneria.token";
export const API_TOKEN_MAX_AGE_SECONDS = 8 * 60 * 60;

export function tokenCookieOptions() {
  // Misma regla que `sessionCookieOptions()`: Compose local sirve por HTTP y
  // setea SESSION_COOKIE_SECURE=false; en producción debe quedar en true.
  const configured = process.env.SESSION_COOKIE_SECURE;
  const secure =
    configured === "false"
      ? false
      : configured === "true"
        ? true
        : process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: API_TOKEN_MAX_AGE_SECONDS,
  };
}
