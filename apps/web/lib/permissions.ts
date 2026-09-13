import type { AppRole } from "./auth";

export type OrdersMode = "ordenes" | "cocina";

/** Solo el chef confirma la recepción, y solo en el KDS de cocina. */
export function canConfirmRecepcion(role: AppRole | undefined, mode: OrdersMode): boolean {
  return role === "cocina" && mode === "cocina";
}

/** Solo el chef marca listo, y solo en el KDS de cocina. */
export function canMarkListo(role: AppRole | undefined, mode: OrdersMode): boolean {
  return role === "cocina" && mode === "cocina";
}

/** Solo el mesero anula un pendiente suyo. */
export function canAnularPendiente(role: AppRole | undefined, order: { status: string; waiter?: string }, me: string): boolean {
  return role === "mesero" && order.status === "pendiente" && order.waiter === me;
}

/** Solo el mesero marca entregado, y solo en su panel. */
export function canMarkEntregado(role: AppRole | undefined): boolean {
  return role === "mesero";
}

/** Solo el mesero crea pedidos. Admin/sucursal/cocina miran en lectura. */
export function canCreateOrder(role: AppRole | undefined): boolean {
  return role === "mesero";
}

/** Solo la sucursal opera el salón (cambia estados de mesa). El dueño mira en lectura. */
export function canChangeTableStatus(role: AppRole | undefined): boolean {
  return role === "sucursal";
}

/** La caja la opera la sucursal. El administrador mira en lectura. */
export function canOperateCash(role: AppRole | undefined): boolean {
  return role === "sucursal";
}
