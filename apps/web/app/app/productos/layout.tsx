"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ProductsView } from "@/components/erp/catalog/ProductsView";
import { CartaVirtualView } from "@/components/erp/catalog/CartaVirtualView";
import { Tabs } from "@/components/ui/Tabs";
import { CategoriesView } from "@/components/erp/catalog/CategoriesView";
import { ModifiersView } from "@/components/erp/catalog/ModifiersView";
import { PriceListsView } from "@/components/erp/catalog/PriceListsView";

const HUB_PATH = "/app/productos";

const tabs = [
  {
    id: "platos",
    label: "Maestro",
    title: "Platos",
    description: "El dato único que alimenta carta, pedidos y reportes.",
  },
  {
    id: "categorias",
    label: "Categorías",
    title: "Categorías de platos",
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
    id: "carta",
    label: "Carta virtual",
    title: "Carta virtual",
    description: "Vista previa de la lista activa, solo lectura. Se edita en Maestro.",
  },
] as const;

type TabId = (typeof tabs)[number]["id"];

/**
 * En la ruta hub los tabs cambian el panel en el lugar (sin navegar).
 * En las subrutas se muestra solo el contenido de la ruta.
 */
export default function ProductosLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [active, setActive] = useState<TabId>("platos");
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  if (pathname !== HUB_PATH) {
    return <>{children}</>;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">{current.title}</h2>
        <p className="text-sm text-ink-400 mt-1">{current.description}</p>
      </div>

      <div className="mb-6">
        <Tabs options={tabs.map((t) => ({ id: t.id, label: t.label }))} value={active} onChange={setActive} />
      </div>

      <div hidden={active !== "platos"}>
        <ProductsView />
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
      <div hidden={active !== "carta"}>
        <CartaVirtualView />
      </div>
    </div>
  );
}
