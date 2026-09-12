import { ModuleGuard } from "@/components/dashboard/ModuleGate";
import { StaffAttendanceView } from "@/components/erp/StaffAttendanceView";

export default function TrabajadoresAsistenciaPage() {
  return (
    <ModuleGuard id="trabajadores">
      <div>
        <div className="mb-6">
          <h2 className="text-section font-medium text-ink-900">Asistencia</h2>
          <p className="text-sm text-ink-400 mt-1">Control semanal de presentes.</p>
        </div>
        <StaffAttendanceView />
      </div>
    </ModuleGuard>
  );
}
