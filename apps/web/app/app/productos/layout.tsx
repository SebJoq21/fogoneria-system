"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ProductsView } from "@/components/erp/catalog/ProductsView";
import { ProductosHub, type CatalogSection } from "@/components/erp/catalog/ProductosHub";
import { CategoriesView } from "@/components/erp/catalog/CategoriesView";
import { ModifiersView } from "@/components/erp/catalog/ModifiersView";
import { PriceListsView } from "@/components/erp/catalog/PriceListsView";
import { ValorizadoView } from "@/components/erp/catalog/ValorizadoView";

const HUB_PATH = "/app/productos";

const tabs = [
  {
    id: "panel",
    label: "Panel",
    title: "Maestro de Productos",
    description: "Accesos rápidos, másteres e informes del catálogo.",
  },
  {
    id: "productos",
    label: "Productos",
    title: "Maestro de Productos",
    description: "El dato único que alimenta carta, pedidos y reportes.",
  },
  {
    id: "categorias",
    label: "Categorías",
    title: "Categorías de producto",
    description: "Agrupan la carta y ordenan el maestro.",
  },
  {
    id: "modificadores",
    label: "Modificadores",
    title: "Modificadores",
    description: "Tamaños, extras y opciones con precio adicional.",
  },
  {
    id: "precios",
    label: "Listas de precios",
    title: "Listas de precios",
    description: "Carta, Delivery y Eventos con vigencia por lista.",
  },
  {
    id: "valorizado",
    label: "Valorizado",
    title: "Valorizado de carta",
    description: "Detalle por producto con total.",
  },
  {
    id: "resumen",
    label: "Resumen",
    title: "Resumen por categoría",
    description: "Subtotales agrupados por categoría.",
  },
] as const;

type TabId = (typeof tabs)[number]["id"];

/**
 * En la ruta hub los tabs cambian el panel en el lugar (sin navegar).
 * En las subrutas se muestra solo el contenido de la ruta.
 */
export default function ProductosLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [active, setActive] = useState<TabId>("panel");
  // Señal para abrir el modal de alta sin navegar (hub "Nuevo producto")
  const [createSignal, setCreateSignal] = useState(0);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  const goNewProduct = () => {
    setActive("productos");
    setCreateSignal((c) => c + 1);
  };

  if (pathname !== HUB_PATH) {
    return <>{children}</>;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">{current.title}</h2>
        <p className="text-sm text-ink-400 mt-1">{current.description}</p>
      </div>

      {active === "panel" && (
        <ProductosHub
          onSelectSection={(s: CatalogSection) => setActive(s)}
          onNewProduct={goNewProduct}
        />
      )}
      <div hidden={active !== "productos"}>
        <ProductsView createSignal={createSignal} />
      </div>
      <div hidden={active !== "categorias"}>
        <CategoriesView />
      </div>
      <div hidden={active !== "modificadores"}>
        <ModifiersView />
      </div>
      <div hidden={active !== "precios"}>
        <PriceListsView />
      </div>
      <div hidden={active !== "valorizado"}>
        <ValorizadoView section="detalle" />
      </div>
      <div hidden={active !== "resumen"}>
        <ValorizadoView section="resumen" />
      </div>

      {/* Navegación entre secciones: solo abajo del contenido */}
      <div className="flex gap-6 overflow-x-auto no-scrollbar border-t border-ink-900/10 mt-8 pt-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={`pt-2.5 -mt-px text-sm font-medium whitespace-nowrap transition-colors border-t-2 cursor-pointer ${
              active === t.id
                ? "border-ink-900 text-ink-900"
                : "border-transparent text-ink-400 hover:text-ink-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
