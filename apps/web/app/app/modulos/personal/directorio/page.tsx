import { ModuleGuard } from "@/components/dashboard/ModuleGate";
import { StaffModule } from "@/components/erp/StaffModule";

export default function PersonalDirectorioPage() {
  return (
    <ModuleGuard id="personal">
      <div>
        <div className="mb-6">
          <h2 className="text-section font-medium text-ink-900">Directorio</h2>
          <p className="text-sm text-ink-400 mt-1">Equipo, roles y turno actual.</p>
        </div>
        <StaffModule tab="equipo" />
      </div>
    </ModuleGuard>
  );
}
