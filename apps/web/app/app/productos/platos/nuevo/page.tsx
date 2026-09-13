"use client";

import { ProductsView } from "@/components/erp/catalog/ProductsView";

export default function NuevoProductoPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">Nuevo plato</h2>
        <p className="text-sm text-ink-400 mt-1">
          Alta directa al maestro con precio de lista activa.
        </p>
      </div>
      <ProductsView startCreating />
    </div>
  );
}
