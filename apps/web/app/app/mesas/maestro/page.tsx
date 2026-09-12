import { SalonTablesView } from "@/components/erp/SalonTablesView";

export default function MesasMaestroPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">Maestro de mesas</h2>
        <p className="text-sm text-ink-400 mt-1">Estructura del salón: el mapa la refleja al instante.</p>
      </div>
      <SalonTablesView />
    </div>
  );
}
