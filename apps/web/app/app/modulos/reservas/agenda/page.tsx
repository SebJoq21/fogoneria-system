import { ModuleGuard } from "@/components/dashboard/ModuleGate";
import { BookingsModule } from "@/components/erp/BookingsModule";

export default function ReservasAgendaPage() {
  return (
    <ModuleGuard id="reservas">
      <div>
        <div className="mb-6">
          <h2 className="text-section font-medium text-ink-900">Agenda</h2>
          <p className="text-sm text-ink-400 mt-1">Reservas por turno con detalle.</p>
        </div>
        <BookingsModule view="agenda" />
      </div>
    </ModuleGuard>
  );
}
