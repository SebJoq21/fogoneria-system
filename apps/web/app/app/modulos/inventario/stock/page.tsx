import { ModuleGuard } from "@/components/dashboard/ModuleGate";
import { InventoryPage } from "@/features/inventory";

export default function InventarioStockPage() {
  return (
    <ModuleGuard id="inventario">
      <div>
        <div className="mb-6">
          <h2 className="text-section font-medium text-ink-900">Stock</h2>
          <p className="text-sm text-ink-400 mt-1">Insumos, mínimos y escandallos.</p>
        </div>
        <InventoryPage />
      </div>
    </ModuleGuard>
  );
}
