import { ModuleGuard } from "@/components/dashboard/ModuleGate";
import { InventoryModule } from "@/components/erp/InventoryModule";

export default function InventarioStockPage() {
  return (
    <ModuleGuard id="inventario">
      <div>
        <div className="mb-6">
          <h2 className="text-section font-medium text-ink-900">Stock</h2>
          <p className="text-sm text-ink-400 mt-1">Insumos, mínimos y escandallos.</p>
        </div>
        <InventoryModule />
      </div>
    </ModuleGuard>
  );
}
