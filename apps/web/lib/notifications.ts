/* Notificaciones en memoria (toasts). Sin persistencia: un aviso es efímero y
   se pierde al recargar; el estado del restaurante no depende de él. */

import type { Notification } from "./dashboard";

export type NotificationInput = Pick<Notification, "title" | "message">;

/** Aviso listo para pintar, con id único y sello de tiempo. */
export function notificationWithId(
  input: NotificationInput,
  previous: Notification | undefined,
  now: number = Date.now(),
): Notification {
  // El id sale del reloj, pero nunca repite el anterior: dos avisos en el mismo
  // milisegundo romperían la key de React y el toast solo mostraría uno.
  const id = previous && previous.id >= now ? previous.id + 1 : now;
  return { id, title: input.title, message: input.message, timestamp: now };
}

/**
 * Antepone un aviso. Un doble disparo idéntico en el mismo milisegundo
 * (Strict Mode, doble click) se colapsa en una sola notificación.
 */
export function appendNotification(
  list: Notification[],
  input: NotificationInput,
  now: number = Date.now(),
): Notification[] {
  const latest = list[0];
  if (
    latest &&
    latest.title === input.title &&
    latest.message === input.message &&
    latest.timestamp === now
  ) {
    return list;
  }
  return [notificationWithId(input, latest, now), ...list];
}
