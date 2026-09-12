"use client";

import { ValorizadoView } from "@/components/erp/catalog/ValorizadoView";

export default function ResumenCategoriaPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">Resumen por categoría</h2>
        <p className="text-sm text-ink-400 mt-1">Subtotales agrupados por categoría.</p>
      </div>
      <ValorizadoView section="resumen" />
    </div>
  );
}
