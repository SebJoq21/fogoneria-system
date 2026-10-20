/* Maestros de catálogo (ERP). Catálogo de la empresa, compartido por todas
   las sucursales: se carga desde la API (`lib/catalog-api.ts`) y vive en
   `ModulesProvider`. El precio nunca está en el producto: vive en la lista. */

export type ProductCategory = {
  id: string;
  name: string;
  position: number;
};

export type ModifierOption = {
  id: string;
  name: string;
  extra: number;
};

export type ModifierGroup = {
  id: string;
  name: string;
  required: boolean;
  multi: boolean;
  options: ModifierOption[];
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  image: string;
  modifierGroupIds: string[];
  status: "Activo" | "Inactivo";
};

export type PriceList = {
  id: string;
  name: string;
  active: boolean;
  validFrom: string;
  validTo: string;
  prices: Record<string, number>;
};

/** Precio de un producto en la lista activa (con fallback a la primera lista). */
export function priceOf(productId: string, lists: PriceList[]): number {
  const active = lists.find((l) => l.active) ?? lists[0];
  return active?.prices[productId] ?? 0;
}

export function categoryName(categoryId: string, categories: ProductCategory[]): string {
  return categories.find((c) => c.id === categoryId)?.name ?? "—";
}

/* ---------- Combos: paquetes con precio fijo (mock, fuera de la API) ---------- */

export type Combo = {
  id: number;
  name: string;
  description: string;
  productIds: string[];
  price: number;
  status: "Activo" | "Inactivo";
};

const CEVICHE = "88888888-8888-8888-8888-888888888881";
const LOMO = "88888888-8888-8888-8888-888888888883";
const CHICHA = "88888888-8888-8888-8888-888888888886";

export const initialCombos: Combo[] = [
  { id: 1, name: "Dúo Criollo", description: "Ceviche + Chicha para dos.", productIds: [CEVICHE, CHICHA], price: 17.0, status: "Activo" },
  { id: 2, name: "Almuerzo Ejecutivo", description: "Fondo + bebida del día.", productIds: [LOMO, CHICHA], price: 24.0, status: "Activo" },
];
