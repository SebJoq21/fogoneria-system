import { ModuleGuard } from "@/components/dashboard/ModuleGate";
import { LoyaltyModule } from "@/components/erp/LoyaltyModule";

export default function FidelizacionReglaPage() {
  return (
    <ModuleGuard id="fidelizacion">
      <div>
        <div className="mb-6">
          <h2 className="text-section font-medium text-ink-900">Regla de puntos</h2>
          <p className="text-sm text-ink-400 mt-1">Puntos por dólar y accesos a clientes y cupones.</p>
        </div>
        <LoyaltyModule />
      </div>
    </ModuleGuard>
  );
}
