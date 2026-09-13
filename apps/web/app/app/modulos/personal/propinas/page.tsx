import { ModuleGuard } from "@/components/dashboard/ModuleGate";
import { StaffModule } from "@/components/erp/StaffModule";

export default function PersonalPropinasPage() {
  return (
    <ModuleGuard id="personal">
      <div>
        <div className="mb-6">
          <h2 className="text-section font-medium text-ink-900">Propinas</h2>
          <p className="text-sm text-ink-400 mt-1">Pozo del día y reparto equitativo.</p>
        </div>
        <StaffModule tab="propinas" />
      </div>
    </ModuleGuard>
  );
}
