'use client';

/**
 * Fachada del salón sobre `ModulesProvider`.
 *
 * El ERP comparte un único estado de mesas, cuentas y reservas con mozo y caja,
 * así que la feature no lo duplica: expone solo la superficie que usan el mapa
 * y la agenda. La escritura vive en `api.ts`; el refresco, en el proveedor.
 *
 * Acoplamiento restante y consciente: `components/dashboard/ModulesProvider`
 * sigue siendo el dueño del estado hasta la ola de órdenes (Fase 4).
 */

import { useModules } from '@/components/dashboard/ModulesProvider';
import {
  useOrdersRealtime,
  type LiveEventKind,
  type LiveOrderEvent,
} from '@/lib/orders-realtime';
import type { RealtimeStatus } from '@/lib/realtime';

export function useSalon() {
  const {
    tables,
    setTables,
    reservations,
    setReservations,
    accounts,
    openAccount,
    currentUser,
    hasSession,
    notify,
    refreshTables,
    refreshReservations,
    tablesLoading,
    tablesError,
    reservationsLoading,
    reservationsError,
    isGeneral,
    branches,
    branchOf,
    activeBranchId,
  } = useModules();

  return {
    tables,
    setTables,
    reservations,
    setReservations,
    accounts,
    openAccount,
    currentUser,
    hasSession,
    notify,
    refreshTables,
    refreshReservations,
    tablesLoading,
    tablesError,
    reservationsLoading,
    reservationsError,
    isGeneral,
    branches,
    branchOf,
    activeBranchId,
  };
}

/** Un solo canal en vivo por pantalla: el mapa y la agenda releen al cambiar. */
export function useSalonEnVivo(
  enabled: boolean,
  onChange: (kind: LiveEventKind) => void,
): { status: RealtimeStatus; lastEvent: LiveOrderEvent | null } {
  return useOrdersRealtime(enabled, onChange);
}
