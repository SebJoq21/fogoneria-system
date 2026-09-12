"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useModules } from "@/components/dashboard/ModulesProvider";

export type CatalogSection =
  | "productos"
  | "categorias"
  | "modificadores"
  | "precios"
  | "valorizado"
  | "resumen";

function QuickLink({
  href,
  label,
  badge,
  onSelect,
}: {
  href?: string;
  label: string;
  badge?: React.ReactNode;
  onSelect?: () => void;
}) {
  const inner = (
    <>
      {label}
      <ArrowUpRight size={14} className="text-ink-400 shrink-0" />
      {badge}
    </>
  );
  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className="flex items-center gap-2 text-sm text-ink-900 hover:underline w-max cursor-pointer"
      >
        {inner}
      </button>
    );
  }
  return (
    <Link
      href={href ?? "#"}
      className="flex items-center gap-2 text-sm text-ink-900 hover:underline w-max"
    >
      {inner}
    </Link>
  );
}

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

/** Workspace del módulo Productos (estilo hub ERP): accesos rápidos + másteres e informes. */
export function ProductosHub({
  onSelectSection,
  onNewProduct,
}: {
  onSelectSection?: (s: CatalogSection) => void;
  onNewProduct?: () => void;
}) {
  const { products, categories, modifierGroups, priceLists, priceOf } = useModules();

  const activos = products.filter((p) => p.status === "Activo");
  const inactivos = products.length - activos.length;
  const sinPrecio = activos.filter((p) => !priceOf(p.id)).length;
  const activeList = priceLists.find((l) => l.active);

  return (
    <div>
      {/* Acceso rápido */}
      <h3 className="text-sm font-medium text-ink-900 mb-3">Acceso rápido</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 mb-10">
        <QuickLink
          label="Artículo"
          onSelect={onSelectSection ? () => onSelectSection("productos") : undefined}
          href="/app/productos/articulos"
          badge={
            <Badge tone="success" dot>
              {activos.length} Activos
            </Badge>
          }
        />
        <QuickLink
          label="Categorías"
          onSelect={onSelectSection ? () => onSelectSection("categorias") : undefined}
          href="/app/productos/categorias"
          badge={<Badge tone="neutral">{categories.length}</Badge>}
        />
        <QuickLink
          label="Modificadores"
          onSelect={onSelectSection ? () => onSelectSection("modificadores") : undefined}
          href="/app/productos/modificadores"
          badge={<Badge tone="neutral">{modifierGroups.length} grupos</Badge>}
        />
        <QuickLink
          label="Listas de precios"
          onSelect={onSelectSection ? () => onSelectSection("precios") : undefined}
          href="/app/productos/precios"
          badge={<Badge tone="neutral">{priceLists.length}</Badge>}
        />
        {inactivos > 0 && (
          <QuickLink
            label="Productos inactivos"
            onSelect={onSelectSection ? () => onSelectSection("productos") : undefined}
            href="/app/productos/articulos"
            badge={<Badge tone="warning">{inactivos}</Badge>}
          />
        )}
        {sinPrecio > 0 && (
          <QuickLink
            label={`Sin precio en ${activeList?.name ?? "lista activa"}`}
            onSelect={onSelectSection ? () => onSelectSection("precios") : undefined}
            href="/app/productos/precios"
            badge={<Badge tone="danger">{sinPrecio}</Badge>}
          />
        )}
      </div>

      {/* Másteres e informes */}
      <h3 className="text-sm font-medium text-ink-900 mb-4">Másteres e informes</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div>
          <h4 className="text-sm font-medium text-ink-900 mb-3">Catálogo de productos</h4>
          <div className="flex flex-col gap-2.5">
            <ColumnLink label="Artículo" onSelect={onSelectSection ? () => onSelectSection("productos") : undefined} href="/app/productos/articulos" />
            <ColumnLink label="Categorías" onSelect={onSelectSection ? () => onSelectSection("categorias") : undefined} href="/app/productos/categorias" />
            <ColumnLink label="Modificadores" onSelect={onSelectSection ? () => onSelectSection("modificadores") : undefined} href="/app/productos/modificadores" />
            <ColumnLink label="Listas de precios" onSelect={onSelectSection ? () => onSelectSection("precios") : undefined} href="/app/productos/precios" />
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-ink-900 mb-3">Transacciones</h4>
          <div className="flex flex-col gap-2.5">
            <ColumnLink href="/app/productos/articulos/nuevo" label="Nuevo producto" onSelect={onNewProduct} />
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
