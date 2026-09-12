import { ModuleGuard } from "@/components/dashboard/ModuleGate";
import { WhatsappModule } from "@/components/erp/WhatsappModule";

export default function WhatsappConfigPage() {
  return (
    <ModuleGuard id="whatsapp">
      <div>
        <div className="mb-6">
          <h2 className="text-section font-medium text-ink-900">Configuración</h2>
          <p className="text-sm text-ink-400 mt-1">Eventos, tiempos y plantillas de mensajes.</p>
        </div>
        <WhatsappModule view="config" />
      </div>
    </ModuleGuard>
  );
}
