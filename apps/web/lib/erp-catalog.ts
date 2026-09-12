/* Maestros de catálogo (ERP): el dato vive aquí una sola vez.
   La Carta Virtual y los módulos consumen estos maestros. */

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
  id: number;
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
  prices: Record<number, number>;
};

export const initialCategories: ProductCategory[] = [
  { id: "entradas", name: "Entradas", position: 1 },
  { id: "fondos", name: "Fondos", position: 2 },
  { id: "bebidas", name: "Bebidas", position: 3 },
  { id: "postres", name: "Postres", position: 4 },
];

export const initialModifierGroups: ModifierGroup[] = [
  {
    id: "tamano",
    name: "Tamaño",
    required: true,
    multi: false,
    options: [
      { id: "tam-regular", name: "Regular", extra: 0 },
      { id: "tam-grande", name: "Grande", extra: 4 },
    ],
  },
  {
    id: "extras",
    name: "Extras",
    required: false,
    multi: true,
    options: [
      { id: "ext-queso", name: "Queso extra", extra: 2 },
      { id: "ext-palta", name: "Palta", extra: 3 },
    ],
  },
  {
    id: "punto",
    name: "Punto de cocción",
    required: true,
    multi: false,
    options: [
      { id: "pto-medio", name: "Al punto", extra: 0 },
      { id: "pto-cocido", name: "Bien cocido", extra: 0 },
    ],
  },
];

export const initialProducts: Product[] = [
  { id: 1, sku: "PLA-001", name: "Ceviche Clásico", description: "Pesca del día marinada en limón sutil, ají limo, cebolla roja y culantro. Acompañado de choclo y camote.", categoryId: "entradas", image: "https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=600&q=80", modifierGroupIds: ["extras"], status: "Activo" },
  { id: 2, sku: "PLA-002", name: "Tequeños de Lomo", description: "Masa crujiente rellena de nuestro clásico lomo saltado, acompañados de salsa huancaína.", categoryId: "entradas", image: "https://images.unsplash.com/photo-1541529086526-db283c563270?auto=format&fit=crop&w=600&q=80", modifierGroupIds: ["extras"], status: "Activo" },
  { id: 3, sku: "PLA-003", name: "Lomo Saltado", description: "Trozos de lomo fino salteados al wok con cebolla, tomate, ají amarillo y sillao. Servido con papas fritas y arroz.", categoryId: "fondos", image: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=600&q=80", modifierGroupIds: ["tamano", "punto"], status: "Activo" },
  { id: 4, sku: "PLA-004", name: "Ají de Gallina", description: "Cremoso guiso de pechuga de pollo deshilachada con ají amarillo, pecanas y queso parmesano.", categoryId: "fondos", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80", modifierGroupIds: ["tamano"], status: "Activo" },
  { id: 5, sku: "PLA-005", name: "Pisco Sour", description: "Nuestro cóctel bandera. Pisco Quebranta, zumo de limón, jarabe de goma, clara de huevo y amargo de Angostura.", categoryId: "bebidas", image: "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=600&q=80", modifierGroupIds: [], status: "Activo" },
  { id: 6, sku: "PLA-006", name: "Chicha Morada", description: "Refrescante bebida tradicional a base de maíz morado, piña, manzana, canela y clavo de olor.", categoryId: "bebidas", image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80", modifierGroupIds: ["tamano"], status: "Activo" },
];

const basePrices: Record<number, number> = {
  1: 15.0, 2: 8.0, 3: 22.0, 4: 18.0, 5: 10.0, 6: 4.0,
};

const plus = (delta: number): Record<number, number> =>
  Object.fromEntries(Object.entries(basePrices).map(([k, v]) => [k, v + delta]));

export const initialPriceLists: PriceList[] = [
  { id: "carta", name: "Carta", active: true, validFrom: "2026-01-01", validTo: "2026-12-31", prices: { ...basePrices } },
  { id: "delivery", name: "Delivery", active: false, validFrom: "2026-01-01", validTo: "2026-12-31", prices: plus(2) },
  { id: "eventos", name: "Eventos", active: false, validFrom: "2026-11-01", validTo: "2026-12-31", prices: plus(-1) },
];

/** Precio de un producto en la lista activa (con fallback a la primera lista). */
export function priceOf(productId: number, lists: PriceList[]): number {
  const active = lists.find((l) => l.active) ?? lists[0];
  return active?.prices[productId] ?? 0;
}

export function categoryName(categoryId: string, categories: ProductCategory[]): string {
  return categories.find((c) => c.id === categoryId)?.name ?? "—";
}

/* ---------- Combos: paquetes con precio fijo ---------- */

export type Combo = {
  id: number;
  name: string;
  description: string;
  productIds: number[];
  price: number;
  status: "Activo" | "Inactivo";
};

export const initialCombos: Combo[] = [
  { id: 1, name: "Dúo Criollo", description: "Ceviche + Chicha para dos.", productIds: [1, 6], price: 17.0, status: "Activo" },
  { id: 2, name: "Almuerzo Ejecutivo", description: "Fondo + bebida del día.", productIds: [3, 6], price: 24.0, status: "Activo" },
];


