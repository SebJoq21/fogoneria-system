'use client';

/** Roles operativos del demo (maestro de Personal). */
import { createContext, useContext, type ReactNode } from 'react';
import { initialRoles, type Role } from '@/lib/erp';
import { readLegacyErpField, useModuleStore } from '@/lib/module-store';

const EMPTY: Role[] = [];

type StaffContextValue = {
  roles: Role[];
  setRoles: (roles: Role[]) => void;
  resetRoles: () => void;
};

const StaffContext = createContext<StaffContextValue | null>(null);

function readLegacy(tenantKey: string): Role[] | null {
  return readLegacyErpField<Role[]>(tenantKey, 'roles');
}

export function StaffProvider({ children }: { children: ReactNode }) {
  const { value: roles, setValue, reset } = useModuleStore<Role[]>({
    id: 'staff',
    empty: EMPTY,
    demo: initialRoles,
    readLegacy,
  });

  return (
    <StaffContext.Provider value={{ roles, setRoles: setValue, resetRoles: reset }}>
      {children}
    </StaffContext.Provider>
  );
}

export function useStaff(): StaffContextValue {
  const context = useContext(StaffContext);
  if (!context) throw new Error('useStaff debe usarse dentro de StaffProvider');
  return context;
}
