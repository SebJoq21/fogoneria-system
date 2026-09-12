"use client";

import { OrdersView } from "@/components/erp/OrdersView";

/** KDS de cocina: comandas de SU sucursal (branchId fijo de sesión).
 *  Al marcar "listo" se notifica al mesero (campana). */
export default function CocinaPage() {
  return <OrdersView />;
}
