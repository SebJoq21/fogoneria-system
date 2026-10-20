/* Constantes del BFF (solo servidor): el access token de la API vive en una
   cookie HttpOnly y el navegador nunca lo ve. */

export const TOKEN_COOKIE = "fogoneria.token";
export const API_TOKEN_MAX_AGE_SECONDS = 8 * 60 * 60;

export function tokenCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: API_TOKEN_MAX_AGE_SECONDS,
  };
}
