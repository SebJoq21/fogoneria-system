"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";
import { cartaSummary } from "@/components/erp/summaries/summary-selectors";

export type CatalogSection =
  | "productos"
  | "categorias"
  | "modificadores"
  | "precios"
  | "valorizado"
  | "resumen";

function ColumnLink({
  href,
  label,
  onSelect,
}: {
  href?: string;
  label: string;
  onSelect?: () => void;
}) {
  const inner = (
    <>
      {label}
      <ArrowUpRight size={14} className="text-ink-400 shrink-0" />
    </>
  );
  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className="flex items-center gap-2 text-sm text-ink-600 hover:text-ink-900 transition-colors w-max cursor-pointer"
      >
        {inner}
      </button>
    );
  }
  return (
    <Link
      href={href ?? "#"}
      className="flex items-center gap-2 text-sm text-ink-600 hover:text-ink-900 transition-colors w-max"
    >
      {inner}
    </Link>
  );
}

/** Workspace del módulo Productos (estilo hub ERP): resumen + másteres e informes. */
export function ProductosHub({
  onSelectSection,
  onNewProduct,
}: {
  onSelectSection?: (s: CatalogSection) => void;
  onNewProduct?: () => void;
}) {
  const { products, categories, priceOf } = useModules();

  const summary = useMemo(() => cartaSummary(products, categories, priceOf), [products, categories, priceOf]);

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

      {/* Másteres e informes */}
      <h3 className="text-sm font-medium text-ink-900 mb-4">Másteres e informes</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div>
          <h4 className="text-sm font-medium text-ink-900 mb-3">Catálogo de platos</h4>
          <div className="flex flex-col gap-2.5">
            <ColumnLink label="Platos" onSelect={onSelectSection ? () => onSelectSection("productos") : undefined} href="/app/productos/articulos" />
            <ColumnLink label="Categorías" onSelect={onSelectSection ? () => onSelectSection("categorias") : undefined} href="/app/productos/categorias" />
            <ColumnLink label="Modificadores" onSelect={onSelectSection ? () => onSelectSection("modificadores") : undefined} href="/app/productos/modificadores" />
            <ColumnLink label="Listas de precios" onSelect={onSelectSection ? () => onSelectSection("precios") : undefined} href="/app/productos/precios" />
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-ink-900 mb-3">Transacciones</h4>
          <div className="flex flex-col gap-2.5">
            <ColumnLink href="/app/productos/articulos/nuevo" label="Nuevo plato" onSelect={onNewProduct} />
            <ColumnLink label="Actualizar precios" onSelect={onSelectSection ? () => onSelectSection("precios") : undefined} href="/app/productos/precios" />
            <ColumnLink href="/app/carta" label="Ver carta virtual" />
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-ink-900 mb-3">Informes</h4>
          <div className="flex flex-col gap-2.5">
            <ColumnLink label="Valorizado de carta" onSelect={onSelectSection ? () => onSelectSection("valorizado") : undefined} href="/app/productos/valorizado" />
            <ColumnLink label="Resumen por categoría" onSelect={onSelectSection ? () => onSelectSection("resumen") : undefined} href="/app/productos/resumen-categoria" />
          </div>
        </div>
      </div>
    </div>
  );
}
