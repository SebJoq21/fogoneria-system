"use client";

import { useMemo } from "react";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";
import { cartaSummary } from "@/components/erp/summaries/summary-selectors";
import { HubBlocks, type HubLink } from "@/components/erp/workspace-ui";

export type CatalogSection =
  | "platos"
  | "categorias"
  | "modificadores"
  | "precios"
  | "valorizado"
  | "resumen"
  | "carta";

/** Panel de Platos: resumen + Acceso rápido + Informes y másteres (norma de hub). */
export function ProductosHub({
  onSelectSection,
  onNewProduct,
}: {
  onSelectSection?: (s: CatalogSection) => void;
  onNewProduct?: () => void;
}) {
  const { products, categories, priceOf } = useModules();

  const summary = useMemo(() => cartaSummary(products, categories, priceOf), [products, categories, priceOf]);
  const sel = onSelectSection;
  const tab = (s: CatalogSection, href: string, label: string): HubLink => ({
    label,
    href,
    ...(sel ? { onSelect: () => sel(s) } : {}),
  });

  const acceso: HubLink[] = [
    {
      label: "Nuevo plato",
      href: "/app/productos/platos/nuevo",
      ...(onNewProduct ? { onSelect: onNewProduct } : {}),
    },
    tab("precios", "/app/productos/precios", "Actualizar precios"),
    tab("carta", "/app/productos", "Ver carta virtual"),
  ];
  const informes: HubLink[] = [
    tab("platos", "/app/productos/platos", "Maestro"),
    tab("categorias", "/app/productos/categorias", "Categorías"),
    tab("modificadores", "/app/productos/modificadores", "Modificadores"),
    tab("precios", "/app/productos/precios", "Listas de precios"),
    tab("valorizado", "/app/productos/valorizado", "Valorizado de carta"),
    tab("resumen", "/app/productos/resumen-categoria", "Resumen por categoría"),
  ];

  return (
    <div>
      <ModuleSummary
        kpis={summary.kpis}
        chartTitle="Catálogo por categoría"
        chartSubtitle="Primera vista de tu maestro"
        ariaLabel="Resumen del catálogo"
      >
        <MiniBars data={summary.bars} label="Platos por categoría" />
      </ModuleSummary>

      <HubBlocks acceso={acceso} informes={informes} />
    </div>
  );
}
