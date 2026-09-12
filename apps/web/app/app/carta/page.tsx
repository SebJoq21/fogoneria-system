"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MenuItem } from "@/lib/dashboard";
import { MenuPreview } from "@/components/dashboard/MenuPreview";
import { MenuEditor } from "@/components/dashboard/MenuEditor";
import { useModules } from "@/components/dashboard/ModulesProvider";

/**
 * Carta Virtual: NO guarda precio propio.
 * Deriva los platos del Maestro de Productos + la lista de precios activa,
 * y reinyecta los cambios del editor al maestro (write-through).
 */
export default function CartaPage() {
  const [view, setView] = useState<"vista" | "editar">("vista");
  const {
    products,
    setProducts,
    categories,
    setCategories,
    priceLists,
    setPriceLists,
    priceOf,
    categoryNameOf,
    notify,
  } = useModules();
  const router = useRouter();

  const activeListName = priceLists.find((l) => l.active)?.name ?? "—";

  const menuItems: MenuItem[] = useMemo(
    () =>
      products
        .filter((p) => p.status === "Activo")
        .map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: priceOf(p.id).toFixed(2),
          category: categoryNameOf(p.categoryId),
          image: p.image,
          status: p.status,
        })),
    [products, priceOf, categoryNameOf],
  );

  const writeThrough = (items: MenuItem[]) => {
    // Ediciones del editor → maestro + lista activa. Bajas → Inactivo (se conserva el dato).
    const seen = new Set(items.map((i) => i.id));
    setProducts(
      products
        .map((p) => {
          const edited = items.find((i) => i.id === p.id);
          if (!edited) {
            return seen.has(p.id) ? p : { ...p, status: "Inactivo" as const };
          }
          let categoryId = p.categoryId;
          const known = categories.find((c) => c.name === edited.category);
          if (known) {
            categoryId = known.id;
          } else if (edited.category.trim()) {
            categoryId = edited.category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            setCategories([
              ...categories,
              {
                id: categoryId,
                name: edited.category,
                position: Math.max(0, ...categories.map((c) => c.position)) + 1,
              },
            ]);
          }
          return {
            ...p,
            name: edited.name,
            description: edited.description,
            categoryId,
            image: edited.image,
          };
        })
        .concat(
          items
            .filter((i) => !products.some((p) => p.id === i.id))
            .map((i) => ({
              id: i.id,
              sku: `PLA-${String(i.id).slice(-3)}`,
              name: i.name,
              description: i.description,
              categoryId:
                categories.find((c) => c.name === i.category)?.id ?? categories[0]?.id ?? "",
              image: i.image,
              modifierGroupIds: [] as string[],
              status: "Activo" as const,
            })),
        ),
    );
    setPriceLists(
      priceLists.map((l) =>
        l.active
          ? {
              ...l,
              prices: {
                ...l.prices,
                ...Object.fromEntries(
                  items.map((i) => [i.id, Number(i.price) || 0]),
                ),
              },
            }
          : l,
      ),
    );
  };

  if (view === "editar") {
    return (
      <MenuEditor
        menuItems={menuItems}
        setMenuItems={writeThrough}
        onPreview={() => setView("vista")}
        onNotify={notify}
      />
    );
  }

  return (
    <div>
      <p className="text-nav text-ink-400 mb-4">
        Precios de la lista activa: <strong className="text-ink-900">{activeListName}</strong> ·{" "}
        <button
          type="button"
          onClick={() => router.push("/app/productos/precios")}
          className="font-medium text-ink-900 hover:underline cursor-pointer"
        >
          Gestionar listas
        </button>
      </p>
      <MenuPreview menuItems={menuItems} onEditMenu={() => setView("editar")} />
    </div>
  );
}
