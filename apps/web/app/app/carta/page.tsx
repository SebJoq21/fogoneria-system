"use client";

import { useMemo } from "react";
import type { MenuItem } from "@/lib/dashboard";
import { MenuPreview } from "@/components/dashboard/MenuPreview";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";
import { cartaSummary } from "@/components/erp/summaries/summary-selectors";

/**
 * Carta Virtual (solo lectura): deriva los platos del Maestro de Productos
 * + la lista de precios activa. La edición vive en /app/productos.
 */
export default function CartaPage() {
  const {
    products,
    categories,
    priceLists,
    priceOf,
    categoryNameOf,
  } = useModules();

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

  const summary = useMemo(() => cartaSummary(products, categories, priceOf), [products, categories, priceOf]);

  return (
    <div>
      <ModuleSummary
        kpis={summary.kpis}
        chartTitle="Platos por categoría"
        chartSubtitle={`Lista activa: ${activeListName} · cómo está compuesta tu carta`}
        ariaLabel="Resumen de carta"
      >
        <MiniBars data={summary.bars} label="Platos activos por categoría" />
      </ModuleSummary>
      <p className="text-nav text-ink-400 mb-4">
        Precios de la lista activa: <strong className="text-ink-900">{activeListName}</strong>
      </p>
      <MenuPreview menuItems={menuItems} />
    </div>
  );
}
