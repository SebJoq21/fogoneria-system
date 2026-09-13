import { ModuleGuard } from "@/components/dashboard/ModuleGate";
import { RolesView } from "@/components/erp/RolesView";

export default function PersonalRolesPage() {
  return (
    <ModuleGuard id="personal">
      <div>
        <div className="mb-6">
          <h2 className="text-section font-medium text-ink-900">Roles</h2>
          <p className="text-sm text-ink-400 mt-1">Roles operativos del equipo.</p>
        </div>
        <RolesView />
      </div>
    </ModuleGuard>
  );
}
