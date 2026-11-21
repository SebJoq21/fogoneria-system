'use client';

/**
 * Provider compartido de tickets de soporte (F6c3).
 *
 * No hay módulo backend de soporte (la vista es demo), así que el estado vive
 * en la capa compartida en vez de en una feature. `ModulesProvider` reexporta
 * `tickets`/`addTicket`/`setTickets` para no tocar las vistas.
 */

import { createContext, useContext, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { initialTickets, type Ticket } from '@/lib/dashboard';
import { readLegacyErpField, useModuleStore } from '@/lib/module-store';

const EMPTY: Ticket[] = [];

type TicketsContextValue = {
  tickets: Ticket[];
  setTickets: Dispatch<SetStateAction<Ticket[]>>;
  resetTickets: () => void;
};

const TicketsContext = createContext<TicketsContextValue | null>(null);

function readLegacy(tenantKey: string): Ticket[] | null {
  return readLegacyErpField<Ticket[]>(tenantKey, 'tickets');
}

export function TicketsProvider({ children }: { children: ReactNode }) {
  const { value, setValue, reset } = useModuleStore<Ticket[]>({
    id: 'tickets',
    empty: EMPTY,
    demo: initialTickets,
    readLegacy,
  });

  return (
    <TicketsContext.Provider
      value={{ tickets: value, setTickets: setValue, resetTickets: reset }}
    >
      {children}
    </TicketsContext.Provider>
  );
}

export function useTickets(): TicketsContextValue {
  const context = useContext(TicketsContext);
  if (!context) throw new Error('useTickets debe usarse dentro de TicketsProvider');
  return context;
}
