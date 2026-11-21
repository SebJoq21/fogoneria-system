'use client';

/**
 * Provider del módulo Órdenes (F6c1): dueño de las cuentas de mesa del POS.
 *
 * Las acciones que orquestan cuentas con `scopes` (mesas/comandas) y el cobro
 * siguen en `ModulesProvider` por compatibilidad; este provider solo posee la
 * colección, su persistencia por empresa y el sync entre pestañas.
 * La migración/purga de `accounts` del `ErpState` v2 corre en el loader de
 * `ModulesProvider` antes de su primer guardado.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { TableAccount } from '@/lib/domain';
import { initialAccounts } from '@/lib/tenancy';
import { readLegacyErpField, useModuleStore } from '@/lib/module-store';

const EMPTY: TableAccount[] = [];

function readLegacy(tenantKey: string): TableAccount[] | null {
  return readLegacyErpField<TableAccount[]>(tenantKey, 'accounts');
}

type AccountsContextValue = {
  accounts: TableAccount[];
  setAccounts: React.Dispatch<React.SetStateAction<TableAccount[]>>;
  resetAccounts: () => void;
};

const AccountsContext = createContext<AccountsContextValue | null>(null);

export function AccountsProvider({ children }: { children: ReactNode }) {
  const { value: accounts, setValue: setAccounts, reset } = useModuleStore<TableAccount[]>({
    id: 'orders',
    empty: EMPTY,
    demo: initialAccounts,
    readLegacy,
  });

  return (
    <AccountsContext.Provider value={{ accounts, setAccounts, resetAccounts: reset }}>
      {children}
    </AccountsContext.Provider>
  );
}

export function useAccounts(): AccountsContextValue {
  const context = useContext(AccountsContext);
  if (!context) throw new Error('useAccounts debe usarse dentro de AccountsProvider');
  return context;
}
