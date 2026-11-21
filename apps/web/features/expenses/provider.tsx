'use client';

/** Estado demo de gastos; la API manda cuando hay sesión. */
import { createContext, useContext, type ReactNode } from 'react';
import { initialExpenses, type Expense } from '@/lib/erp';
import { readLegacyErpField, useModuleStore } from '@/lib/module-store';

const EMPTY: Expense[] = [];

type ExpensesContextValue = {
  expenses: Expense[];
  setExpenses: (expenses: Expense[]) => void;
  resetExpenses: () => void;
};

const ExpensesContext = createContext<ExpensesContextValue | null>(null);

function readLegacy(tenantKey: string): Expense[] | null {
  return readLegacyErpField<Expense[]>(tenantKey, 'expenses');
}

export function ExpensesProvider({ children }: { children: ReactNode }) {
  const { value: expenses, setValue, reset } = useModuleStore<Expense[]>({
    id: 'expenses',
    empty: EMPTY,
    demo: initialExpenses,
    readLegacy,
  });

  return (
    <ExpensesContext.Provider value={{ expenses, setExpenses: setValue, resetExpenses: reset }}>
      {children}
    </ExpensesContext.Provider>
  );
}

export function useExpenses(): ExpensesContextValue {
  const context = useContext(ExpensesContext);
  if (!context) throw new Error('useExpenses debe usarse dentro de ExpensesProvider');
  return context;
}
