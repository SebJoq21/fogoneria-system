/* Puente catálogo ↔ API (tarea 63).
   Traduce los nombres snake_case del backend a los tipos del ERP y expone
   las mutaciones que consume `ModulesProvider`. */

import { apiFetch } from "./api";
import type { ModifierGroup, PriceList, Product, ProductCategory } from "./erp-catalog";

export const DEFAULT_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80";

const num = (value: string | number | null | undefined): number => Number(value ?? 0) || 0;

type ApiCategory = {
  id: string;
  nombre: string;
  posicion: number;
  activa: boolean;
};

type ApiDish = {
  id: string;
  categoria_id: string;
  sku: string;
  nombre: string;
  descripcion: string | null;
  foto_url: string | null;
  activo: boolean;
  platos_grupos_modificadores?: { grupo_id: string }[];
};

type ApiModifierOption = { id: string; nombre: string; precio_extra: string | number };

type ApiModifierGroup = {
  id: string;
  nombre: string;
  obligatorio: boolean;
  permite_multiple: boolean;
  activo: boolean;
  opciones_modificadores: ApiModifierOption[];
};

type ApiPriceList = {
  id: string;
  nombre: string;
  activa: boolean;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
};

type ApiPrice = { lista_id: string; plato_id: string; precio: string | number };

type ApiDishPage = { items: ApiDish[] };

export type CatalogSnapshot = {
  categories: ProductCategory[];
  products: Product[];
  modifierGroups: ModifierGroup[];
  priceLists: PriceList[];
};

const toCategory = (c: ApiCategory): ProductCategory => ({
  id: c.id,
  name: c.nombre,
  position: c.posicion,
});

const toProduct = (d: ApiDish): Product => ({
  id: d.id,
  sku: d.sku,
  name: d.nombre,
  description: d.descripcion ?? "",
  categoryId: d.categoria_id,
  image: d.foto_url || DEFAULT_PRODUCT_IMAGE,
  modifierGroupIds: (d.platos_grupos_modificadores ?? []).map((g) => g.grupo_id),
  status: d.activo ? "Activo" : "Inactivo",
});

const toModifierGroup = (g: ApiModifierGroup): ModifierGroup => ({
  id: g.id,
  name: g.nombre,
  required: g.obligatorio,
  multi: g.permite_multiple,
  options: g.opciones_modificadores.map((o) => ({
    id: o.id,
    name: o.nombre,
    extra: num(o.precio_extra),
  })),
});

const toPriceList = (l: ApiPriceList, prices: Record<string, number>): PriceList => ({
  id: l.id,
  name: l.nombre,
  active: l.activa,
  validFrom: l.vigencia_desde?.slice(0, 10) ?? "",
  validTo: l.vigencia_hasta?.slice(0, 10) ?? "",
  prices,
});

/** Carga maestros + precios de todas las listas en un solo snapshot. */
export async function fetchCatalog(): Promise<CatalogSnapshot> {
  const [categories, dishes, groups, lists] = await Promise.all([
    apiFetch<ApiCategory[]>("/catalog/categories"),
    apiFetch<ApiDishPage>("/catalog/dishes?limit=100"),
    apiFetch<ApiModifierGroup[]>("/catalog/modifier-groups"),
    apiFetch<ApiPriceList[]>("/pricing/price-lists"),
  ]);

  const priceBooks = await Promise.all(
    lists.map(async (list) => {
      const rows = await apiFetch<ApiPrice[]>(`/pricing/price-lists/${list.id}/prices`);
      const prices: Record<string, number> = {};
      rows.forEach((row) => {
        prices[row.plato_id] = num(row.precio);
      });
      return toPriceList(list, prices);
    }),
  );

  return {
    categories: categories.map(toCategory),
    products: dishes.items.map(toProduct),
    modifierGroups: groups.map(toModifierGroup),
    priceLists: priceBooks,
  };
}

/* ---------- Categorías ---------- */

export async function createCategory(input: { name: string; position: number }): Promise<void> {
  await apiFetch("/catalog/categories", {
    method: "POST",
    body: { nombre: input.name, posicion: input.position },
  });
}

export async function updateCategory(
  id: string,
  input: { name?: string; position?: number },
): Promise<void> {
  await apiFetch(`/catalog/categories/${id}`, {
    method: "PATCH",
    body: {
      ...(input.name !== undefined ? { nombre: input.name } : {}),
      ...(input.position !== undefined ? { posicion: input.position } : {}),
    },
  });
}

export async function deactivateCategory(id: string): Promise<void> {
  await apiFetch(`/catalog/categories/${id}`, { method: "DELETE" });
}

/* ---------- Platos ---------- */

export type DishInput = {
  name: string;
  description: string;
  categoryId: string;
  image: string;
  status: "Activo" | "Inactivo";
  modifierGroupIds: string[];
};

export async function createDish(input: DishInput & { sku: string }): Promise<string> {
  const created = await apiFetch<ApiDish>("/catalog/dishes", {
    method: "POST",
    body: {
      categoriaId: input.categoryId,
      sku: input.sku,
      nombre: input.name,
      descripcion: input.description,
      fotoUrl: input.image,
      activo: input.status === "Activo",
      grupoIds: input.modifierGroupIds,
    },
  });
  return created.id;
}

export async function updateDish(id: string, input: DishInput): Promise<void> {
  await apiFetch(`/catalog/dishes/${id}`, {
    method: "PATCH",
    body: {
      categoriaId: input.categoryId,
      nombre: input.name,
      descripcion: input.description,
      fotoUrl: input.image,
      activo: input.status === "Activo",
      grupoIds: input.modifierGroupIds,
    },
  });
}

export async function setDishActive(id: string, active: boolean): Promise<void> {
  await apiFetch(`/catalog/dishes/${id}`, { method: "PATCH", body: { activo: active } });
}

/* ---------- Grupos de modificadores ---------- */

export type ModifierOptionInput = { name: string; extra: number };

export async function createModifierGroup(input: {
  name: string;
  required: boolean;
  multi: boolean;
}): Promise<void> {
  await apiFetch("/catalog/modifier-groups", {
    method: "POST",
    body: {
      nombre: input.name,
      obligatorio: input.required,
      permiteMultiple: input.multi,
    },
  });
}

export async function updateModifierGroup(
  id: string,
  input: {
    name?: string;
    required?: boolean;
    multi?: boolean;
    options?: ModifierOptionInput[];
  },
): Promise<void> {
  await apiFetch(`/catalog/modifier-groups/${id}`, {
    method: "PATCH",
    body: {
      ...(input.name !== undefined ? { nombre: input.name } : {}),
      ...(input.required !== undefined ? { obligatorio: input.required } : {}),
      ...(input.multi !== undefined ? { permiteMultiple: input.multi } : {}),
      ...(input.options
        ? {
            opciones: input.options.map((o) => ({ nombre: o.name, precioExtra: o.extra })),
          }
        : {}),
    },
  });
}

export async function deactivateModifierGroup(id: string): Promise<void> {
  await apiFetch(`/catalog/modifier-groups/${id}`, { method: "DELETE" });
}

/* ---------- Listas de precios ---------- */

export async function createPriceList(name: string): Promise<string> {
  const created = await apiFetch<ApiPriceList>("/pricing/price-lists", {
    method: "POST",
    body: { nombre: name },
  });
  return created.id;
}

export async function activatePriceList(id: string): Promise<void> {
  await apiFetch(`/pricing/price-lists/${id}/activate`, { method: "POST" });
}

export async function setPrices(
  listId: string,
  items: { platoId: string; precio: number }[],
): Promise<void> {
  if (items.length === 0) return;
  await apiFetch(`/pricing/price-lists/${listId}/prices`, {
    method: "PUT",
    body: { items },
  });
}
