'use client';

/** Estado demo de inventario (insumos y kardex); el stock real vive en la API. */
import { createContext, useContext, type ReactNode } from 'react';
import {
  initialIngredients,
  initialMovements,
  type Ingredient,
  type StockMovement,
} from '@/lib/erp';
import {
  readLegacyErpField,
  useModuleStore,
  type InventoryStoreState,
} from '@/lib/module-store';

const EMPTY: InventoryStoreState = { ingredients: [], movements: [] };
const DEMO: InventoryStoreState = {
  ingredients: initialIngredients,
  movements: initialMovements,
};

function readLegacy(tenantKey: string): InventoryStoreState | null {
  const ingredients = readLegacyErpField<Ingredient[]>(tenantKey, 'ingredients');
  const movements = readLegacyErpField<StockMovement[]>(tenantKey, 'movements');
  if (ingredients === null && movements === null) return null;
  return { ingredients: ingredients ?? [], movements: movements ?? [] };
}

type InventoryContextValue = {
  ingredients: Ingredient[];
  setIngredients: (ingredients: Ingredient[]) => void;
  movements: StockMovement[];
  setMovements: (movements: StockMovement[]) => void;
  resetInventory: () => void;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const { value, setValue, reset } = useModuleStore<InventoryStoreState>({
    id: 'inventory',
    empty: EMPTY,
    demo: DEMO,
    readLegacy,
  });

  return (
    <InventoryContext.Provider
      value={{
        ingredients: value.ingredients,
        setIngredients: (ingredients) => setValue((previous) => ({ ...previous, ingredients })),
        movements: value.movements,
        setMovements: (movements) => setValue((previous) => ({ ...previous, movements })),
        resetInventory: reset,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory(): InventoryContextValue {
  const context = useContext(InventoryContext);
  if (!context) throw new Error('useInventory debe usarse dentro de InventoryProvider');
  return context;
}
