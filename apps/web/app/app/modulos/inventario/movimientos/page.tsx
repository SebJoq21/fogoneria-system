import { ModuleGuard } from "@/components/dashboard/ModuleGate";
import { MovementsPage } from "@/features/inventario";

export default function InventarioMovimientosPage() {
  return (
    <ModuleGuard id="inventario">
      <div>
        <div className="mb-6">
          <h2 className="text-section font-medium text-ink-900">Movimientos</h2>
          <p className="text-sm text-ink-400 mt-1">Kardex: entradas, salidas y ajustes.</p>
        </div>
        <MovementsPage />
      </div>
    </ModuleGuard>
  );
}
