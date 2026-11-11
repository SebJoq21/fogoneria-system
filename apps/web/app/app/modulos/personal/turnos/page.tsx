import { ModuleGuard } from "@/components/dashboard/ModuleGate";
import { StaffTurnosView } from "@/components/erp/StaffTurnosView";

export default function PersonalTurnosPage() {
  return (
    <ModuleGuard id="personal">
      <div>
        <div className="mb-6">
          <h2 className="text-section font-medium text-ink-900">Turnos</h2>
          <p className="text-sm text-ink-400 mt-1">Planificador semanal por colaborador.</p>
        </div>
        <StaffTurnosView />
      </div>
    </ModuleGuard>
  );
}
