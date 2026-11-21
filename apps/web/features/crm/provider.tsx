'use client';

/**
 * Provider del módulo CRM (F6): dueño del estado de clientes del demo.
 *
 * La API sigue mandando cuando hay sesión (`ClientesPage` lee `/crm/clientes`);
 * este provider conserva la lista demo y la comparte con `ModulesProvider` por
 * compatibilidad (`useModules().customers`). Persiste por empresa y migra la
 * lista antigua del `ErpState` v2 para no perder datos al navegar.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSession } from '@/components/dashboard/providers/session';
import { initialCustomers, type Customer } from '@/lib/erp';
import { ANON_TENANT_KEY, loadErpState } from '@/lib/persistence';
import { tenantKeyOf } from '@/lib/session-state';
import { DEMO_EMPRESA_ID } from '@/lib/tenancy';

const CRM_STORAGE_KEY = 'fogoneria:crm:v1';

type CrmContextValue = {
  customers: Customer[];
  setCustomers: (customers: Customer[]) => void;
  addPoints: (customerId: number, points: number) => void;
  resetCustomers: () => void;
};

const CrmContext = createContext<CrmContextValue | null>(null);

function storageKey(tenantKey: string): string {
  return `${CRM_STORAGE_KEY}:${tenantKey}`;
}

function demoTenant(tenantKey: string): boolean {
  return tenantKey === ANON_TENANT_KEY || tenantKey === DEMO_EMPRESA_ID;
}

function readCustomers(tenantKey: string): Customer[] | null {
  try {
    const raw = localStorage.getItem(storageKey(tenantKey));
    if (raw) {
      const parsed = JSON.parse(raw) as Customer[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* almacenamiento no disponible o JSON inválido */
  }
  // Migración desde el estado v2 que antes guardaba `customers` en ErpState.
  const legacy = loadErpState(tenantKey) as (ReturnType<typeof loadErpState> & {
    customers?: Customer[];
  });
  return legacy?.customers ?? null;
}

function saveCustomers(tenantKey: string, customers: Customer[]): void {
  try {
    localStorage.setItem(storageKey(tenantKey), JSON.stringify(customers));
  } catch {
    /* almacenamiento no disponible */
  }
}

export function CrmProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useSession();
  const tenantKey = tenantKeyOf(currentUser);
  const [customers, setCustomersState] = useState<Customer[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = readCustomers(tenantKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación por tenant
    setCustomersState(saved ?? (demoTenant(tenantKey) ? initialCustomers : []));
    setHydrated(true);
  }, [tenantKey]);

  useEffect(() => {
    if (hydrated) saveCustomers(tenantKey, customers);
  }, [customers, hydrated, tenantKey]);

  const setCustomers = useCallback((next: Customer[]) => {
    setCustomersState(next);
  }, []);

  const addPoints = useCallback((customerId: number, points: number) => {
    setCustomersState((previous) =>
      previous.map((customer) =>
        customer.id === customerId
          ? {
              ...customer,
              points: customer.points + points,
              visits: customer.visits + 1,
              lastVisit: 'Hoy',
            }
          : customer,
      ),
    );
  }, []);

  const resetCustomers = useCallback(() => {
    try {
      localStorage.removeItem(storageKey(tenantKey));
    } catch {
      /* almacenamiento no disponible */
    }
    setCustomersState(demoTenant(tenantKey) ? initialCustomers : []);
  }, [tenantKey]);

  const value = useMemo(
    () => ({ customers, setCustomers, addPoints, resetCustomers }),
    [customers, setCustomers, addPoints, resetCustomers],
  );

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm(): CrmContextValue {
  const context = useContext(CrmContext);
  if (!context) throw new Error('useCrm debe usarse dentro de CrmProvider');
  return context;
}
