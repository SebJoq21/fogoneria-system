"use client";

import { ProductsView } from "@/components/erp/catalog/ProductsView";

export default function ArticulosPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">Platos</h2>
        <p className="text-sm text-ink-400 mt-1">
          Maestro de platos: SKU, datos, categoría y modificadores.
        </p>
      </div>
      <ProductsView />
    </div>
  );
}
