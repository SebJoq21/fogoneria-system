'use client';

/**
 * Provider del módulo Reservas (F6c3): dueño de la agenda demo.
 *
 * Con sesión la agenda real viene de la API (`liveReservations` en
 * `ModulesProvider`); este store solo guarda el demo persistido.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { initialReservations, type Reservation } from '@/lib/erp';
import { readLegacyErpField, useModuleStore } from '@/lib/module-store';

const EMPTY: Reservation[] = [];

type ReservationsContextValue = {
  reservations: Reservation[];
  setReservations: (reservations: Reservation[]) => void;
  resetReservations: () => void;
};

const ReservationsContext = createContext<ReservationsContextValue | null>(null);

function readLegacy(tenantKey: string): Reservation[] | null {
  return readLegacyErpField<Reservation[]>(tenantKey, 'reservations');
}

export function ReservationsProvider({ children }: { children: ReactNode }) {
  const { value, setValue, reset } = useModuleStore<Reservation[]>({
    id: 'reservations',
    empty: EMPTY,
    demo: initialReservations,
    readLegacy,
  });

  return (
    <ReservationsContext.Provider
      value={{
        reservations: value,
        setReservations: setValue,
        resetReservations: reset,
      }}
    >
      {children}
    </ReservationsContext.Provider>
  );
}

export function useReservations(): ReservationsContextValue {
  const context = useContext(ReservationsContext);
  if (!context) throw new Error('useReservations debe usarse dentro de ReservationsProvider');
  return context;
}
