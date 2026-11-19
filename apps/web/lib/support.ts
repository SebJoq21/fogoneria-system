/**
 * Canal de soporte para el restablecimiento de contraseñas.
 *
 * La API no expone un endpoint de recuperación ni un servicio de correo: el
 * cambio de contraseña lo gestiona una persona del equipo. La web solo abre el
 * cliente de correo con el mensaje prellenado; no simula un envío.
 */

export const SUPPORT_EMAIL = "soporte@fogoneria.com";

/**
 * Construye un `mailto:` al soporte con asunto y cuerpo prellenados.
 *
 * `URLSearchParams` codifica `@` y `+` del correo, y sus espacios (`+`) se
 * convierten a `%20` porque RFC 6068 espera percent-encoding en `mailto:` y
 * varios clientes muestran el `+` literal.
 */
export function supportMailto({
  email,
  subject,
}: {
  email?: string;
  subject?: string;
} = {}): string {
  const cleanEmail = email?.trim();
  const params = new URLSearchParams({
    subject: subject ?? "Recuperar contraseña",
    body: cleanEmail
      ? `Hola, necesito recuperar la contraseña de mi cuenta de Fogonería.\n\nCorreo registrado: ${cleanEmail}`
      : "Hola, necesito recuperar la contraseña de mi cuenta de Fogonería.",
  });
  return `mailto:${SUPPORT_EMAIL}?${params.toString().replace(/\+/g, "%20")}`;
}
