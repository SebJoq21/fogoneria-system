import { ModuleGuard } from "@/components/dashboard/ModuleGate";
import { TemplatesView } from "@/components/erp/TemplatesView";

export default function WhatsappPlantillasPage() {
  return (
    <ModuleGuard id="whatsapp">
      <div>
        <div className="mb-6">
          <h2 className="text-section font-medium text-ink-900">Plantillas</h2>
          <p className="text-sm text-ink-400 mt-1">Textos por evento con variables.</p>
        </div>
        <TemplatesView />
      </div>
    </ModuleGuard>
  );
}
