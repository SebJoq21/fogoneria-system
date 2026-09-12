"use client";

import { MozoView } from "@/components/erp/MozoView";

export default function MozoPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">Mis órdenes</h2>
        <p className="text-sm text-ink-400 mt-1">Toma pedidos y sigue su estado.</p>
      </div>
      <MozoView />
    </div>
  );
}
