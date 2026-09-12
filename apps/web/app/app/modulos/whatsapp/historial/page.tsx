import { ModuleGuard } from "@/components/dashboard/ModuleGate";
import { WhatsappModule } from "@/components/erp/WhatsappModule";

export default function WhatsappHistorialPage() {
  return (
    <ModuleGuard id="whatsapp">
      <div>
        <div className="mb-6">
          <h2 className="text-section font-medium text-ink-900">Historial de envíos</h2>
          <p className="text-sm text-ink-400 mt-1">Entregas por evento y estado.</p>
        </div>
        <WhatsappModule view="historial" />
      </div>
    </ModuleGuard>
  );
}
