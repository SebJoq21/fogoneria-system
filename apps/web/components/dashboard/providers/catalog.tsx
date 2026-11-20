"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ApiError } from "@/lib/api";
import * as catalogApi from "@/lib/catalog-api";
import {
  categoryName,
  priceOf,
  type ModifierGroup,
  type PriceList,
  type Product,
  type ProductCategory,
} from "@/lib/erp-catalog";
import { useSession } from "./session";

/** Entrada de alta/edición de un plato (el precio va aparte, a la lista). */
export type ProductInput = {
  id?: string;
  name: string;
  description: string;
  categoryId: string;
  image: string;
  status: "Activo" | "Inactivo";
  modifierGroupIds: string[];
  price: number;
};

/** Catálogo de la empresa servido por la API (tarea 63). */
export type CatalogState = {
  categories: ProductCategory[];
  products: Product[];
  modifierGroups: ModifierGroup[];
  priceLists: PriceList[];
};

const EMPTY_CATALOG: CatalogState = {
  categories: [],
  products: [],
  modifierGroups: [],
  priceLists: [],
};

/** Siguiente SKU secuencial (PLA-00N) a partir del maestro actual. */
function nextSku(products: Product[]): string {
  const max = products.reduce((acc, p) => {
    const suffix = Number(p.sku.match(/(\d+)\s*$/)?.[1] ?? 0);
    return Number.isFinite(suffix) ? Math.max(acc, suffix) : acc;
  }, 0);
  return `PLA-${String(max + 1).padStart(3, "0")}`;
}

export type CatalogoContextValue = CatalogState & {
  catalogLoading: boolean;
  catalogError: string | null;
  /** Se incrementa con cada snapshot exitoso (lo usa la poda de combos). */
  catalogVersion: number;
  refreshCatalog: (signal?: AbortSignal) => Promise<void>;
  saveProduct: (input: ProductInput) => Promise<void>;
  setProductActive: (id: string, active: boolean) => Promise<void>;
  saveCategory: (input: { id?: string; name: string; position: number }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  createModifierGroup: (input: { name: string; required: boolean; multi: boolean }) => Promise<void>;
  updateModifierGroup: (
    id: string,
    input: {
      name?: string;
      required?: boolean;
      multi?: boolean;
      // `id` viaja a la API, que sincroniza las opciones por id: sin él se
      // recrearían (y el borrado de una opción usada en órdenes da 409).
      options?: { id?: string; name: string; extra: number }[];
    },
  ) => Promise<void>;
  deleteModifierGroup: (id: string) => Promise<void>;
  createPriceList: (name: string, fromListId?: string) => Promise<void>;
  activatePriceList: (id: string) => Promise<void>;
  setPrice: (listId: string, platoId: string, price: number) => Promise<void>;
  priceOf: (productId: string) => number;
  categoryNameOf: (categoryId: string) => string;
};

const Ctx = createContext<CatalogoContextValue | null>(null);

/**
 * Catálogo y precios de la empresa (Fase 4 etapa 3).
 *
 * Única fuente de verdad de los maestros: la API (`lib/catalog-api.ts`) los
 * hidrata al iniciar sesión y los limpia al salir. `ModulesProvider` reexpone
 * este estado por compatibilidad y `features/catalogo` lo consume directo.
 * El catálogo es de la empresa, no de la sucursal, así que solo depende de la
 * sesión; la poda de combos huérfanos vive en `ModulesProvider` (dueño de los
 * combos) y reacciona a `catalogVersion`/`products`.
 */
export function CatalogoProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useSession();

  const [catalog, setCatalog] = useState<CatalogState>(EMPTY_CATALOG);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogVersion, setCatalogVersion] = useState(0);
  /** Descarta respuestas que llegan después de una recarga más nueva. */
  const catalogRequest = useRef(0);

  const refreshCatalog = useCallback(async (signal?: AbortSignal) => {
    const requestId = ++catalogRequest.current;
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const snapshot = await catalogApi.fetchCatalog(signal);
      if (requestId !== catalogRequest.current) return;
      setCatalog(snapshot);
      setCatalogVersion((version) => version + 1);
    } catch (error) {
      if (requestId !== catalogRequest.current || signal?.aborted) return;
      setCatalogError(
        error instanceof ApiError ? error.message : "No se pudo cargar el catálogo.",
      );
    } finally {
      if (requestId === catalogRequest.current) setCatalogLoading(false);
    }
  }, []);

  /* Cargar el catálogo al iniciar sesión (o cambiar de empresa) y limpiarlo al salir. */
  useEffect(() => {
    if (!currentUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpiar el catálogo al cerrar sesión
      setCatalog(EMPTY_CATALOG);
      return;
    }
    const controller = new AbortController();
    void refreshCatalog(controller.signal);
    return () => controller.abort();
  }, [currentUser, refreshCatalog]);

  const saveProduct = useCallback(
    async (input: ProductInput) => {
      const payload = {
        name: input.name,
        description: input.description,
        categoryId: input.categoryId,
        image: input.image,
        status: input.status,
        modifierGroupIds: input.modifierGroupIds,
      };
      const isNew = !input.id;
      const id =
        input.id ?? (await catalogApi.createDish({ ...payload, sku: nextSku(catalog.products) }));
      try {
        if (input.id) await catalogApi.updateDish(input.id, payload);

        const activeList = catalog.priceLists.find((l) => l.active);
        if (activeList) {
          await catalogApi.setPrices(activeList.id, [{ platoId: id, precio: input.price }]);
        }
      } catch (error) {
        // El plato y su precio son dos llamadas: si falla la segunda, se
        // deshace el alta para no dejar platos sin precio.
        if (isNew) {
          try {
            await catalogApi.deleteDish(id);
          } catch {
            /* la limpieza es best-effort */
          }
        }
        throw error;
      }
      await refreshCatalog();
    },
    [catalog.products, catalog.priceLists, refreshCatalog],
  );

  const setProductActive = useCallback(
    async (id: string, active: boolean) => {
      await catalogApi.setDishActive(id, active);
      await refreshCatalog();
    },
    [refreshCatalog],
  );

  const saveCategory = useCallback(
    async (input: { id?: string; name: string; position: number }) => {
      if (input.id)
        await catalogApi.updateCategory(input.id, { name: input.name, position: input.position });
      else await catalogApi.createCategory({ name: input.name, position: input.position });
      await refreshCatalog();
    },
    [refreshCatalog],
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      await catalogApi.deactivateCategory(id);
      await refreshCatalog();
    },
    [refreshCatalog],
  );

  const createModifierGroup = useCallback(
    async (input: { name: string; required: boolean; multi: boolean }) => {
      await catalogApi.createModifierGroup(input);
      await refreshCatalog();
    },
    [refreshCatalog],
  );

  const updateModifierGroup = useCallback(
    async (
      id: string,
      input: {
        name?: string;
        required?: boolean;
        multi?: boolean;
        // `id` viaja a la API, que sincroniza las opciones por id: sin él se
        // recrearían (y el borrado de una opción usada en órdenes da 409).
        options?: { id?: string; name: string; extra: number }[];
      },
    ) => {
      await catalogApi.updateModifierGroup(id, input);
      await refreshCatalog();
    },
    [refreshCatalog],
  );

  const deleteModifierGroup = useCallback(
    async (id: string) => {
      await catalogApi.deactivateModifierGroup(id);
      await refreshCatalog();
    },
    [refreshCatalog],
  );

  const createPriceList = useCallback(
    async (name: string, fromListId?: string) => {
      const id = await catalogApi.createPriceList(name);
      const source = fromListId ? catalog.priceLists.find((l) => l.id === fromListId) : undefined;
      try {
        if (source) {
          const items = Object.entries(source.prices).map(([platoId, precio]) => ({
            platoId,
            precio,
          }));
          await catalogApi.setPrices(id, items);
        }
      } catch (error) {
        // Copiar precios es una segunda llamada: si falla, se desactiva la lista
        // recién creada para no dejar una lista vacía activa por error.
        try {
          await catalogApi.deletePriceList(id);
        } catch {
          /* la limpieza es best-effort */
        }
        throw error;
      }
      await refreshCatalog();
    },
    [catalog.priceLists, refreshCatalog],
  );

  const activatePriceList = useCallback(
    async (id: string) => {
      await catalogApi.activatePriceList(id);
      await refreshCatalog();
    },
    [refreshCatalog],
  );

  const setPrice = useCallback(
    async (listId: string, platoId: string, price: number) => {
      await catalogApi.setPrices(listId, [{ platoId, precio: price }]);
      await refreshCatalog();
    },
    [refreshCatalog],
  );

  const priceOfCallback = useCallback(
    (productId: string) => priceOf(productId, catalog.priceLists),
    [catalog.priceLists],
  );

  const categoryNameOf = useCallback(
    (categoryId: string) => categoryName(categoryId, catalog.categories),
    [catalog.categories],
  );

  const value = useMemo<CatalogoContextValue>(
    () => ({
      categories: catalog.categories,
      products: catalog.products,
      modifierGroups: catalog.modifierGroups,
      priceLists: catalog.priceLists,
      catalogLoading,
      catalogError,
      catalogVersion,
      refreshCatalog,
      saveProduct,
      setProductActive,
      saveCategory,
      deleteCategory,
      createModifierGroup,
      updateModifierGroup,
      deleteModifierGroup,
      createPriceList,
      activatePriceList,
      setPrice,
      priceOf: priceOfCallback,
      categoryNameOf,
    }),
    [
      catalog,
      catalogLoading,
      catalogError,
      catalogVersion,
      refreshCatalog,
      saveProduct,
      setProductActive,
      saveCategory,
      deleteCategory,
      createModifierGroup,
      updateModifierGroup,
      deleteModifierGroup,
      createPriceList,
      activatePriceList,
      setPrice,
      priceOfCallback,
      categoryNameOf,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCatalogoState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCatalogoState debe usarse dentro de CatalogoProvider");
  return ctx;
}
