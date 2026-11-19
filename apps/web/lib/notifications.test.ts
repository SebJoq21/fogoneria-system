import { describe, expect, it } from "vitest";
import { appendNotification, notificationWithId } from "./notifications";
import type { Notification } from "./dashboard";

const base: Notification[] = [
  { id: 10, title: "Turno abierto", message: "Fondo 100", timestamp: 10 },
];

describe("appendNotification", () => {
  it("antepone el aviso con su sello de tiempo", () => {
    const list = appendNotification(base, { title: "Mesa creada", message: "Mesa 4" }, 20);
    expect(list[0]).toEqual({ id: 20, title: "Mesa creada", message: "Mesa 4", timestamp: 20 });
    expect(list[1]).toBe(base[0]);
  });

  it("colapsa el doble disparo idéntico en el mismo milisegundo", () => {
    const once = appendNotification([], { title: "Guardado", message: "Listo" }, 30);
    const twice = appendNotification(once, { title: "Guardado", message: "Listo" }, 30);
    expect(twice).toHaveLength(1);
    expect(twice[0].id).toBe(30);
  });

  it("conserva dos avisos distintos del mismo milisegundo con ids únicos", () => {
    const first = appendNotification([], { title: "A", message: "uno" }, 40);
    const second = appendNotification(first, { title: "B", message: "dos" }, 40);
    expect(second).toHaveLength(2);
    expect(second[0].id).toBe(41);
    expect(second[1].id).toBe(40);
  });

  it("no muta la lista recibida", () => {
    appendNotification(base, { title: "Otro", message: "aviso" }, 50);
    expect(base).toEqual([
      { id: 10, title: "Turno abierto", message: "Fondo 100", timestamp: 10 },
    ]);
  });
});

describe("notificationWithId", () => {
  it("adelanta el id cuando el reloj no avanzó respecto del anterior", () => {
    expect(notificationWithId({ title: "x", message: "y" }, base[0], 5).id).toBe(11);
  });

  it("usa el reloj cuando el anterior es más viejo", () => {
    expect(notificationWithId({ title: "x", message: "y" }, base[0], 99).id).toBe(99);
  });
});
