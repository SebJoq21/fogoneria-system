"use client";

import { ValorizadoView } from "@/components/erp/catalog/ValorizadoView";

export default function ValorizadoPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">Valorizado de carta</h2>
        <p className="text-sm text-ink-400 mt-1">Detalle por producto con total.</p>
      </div>
      <ValorizadoView section="detalle" />
    </div>
  );
}
