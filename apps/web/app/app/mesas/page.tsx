import { MesasPage } from "@/features/salon";

export default function MesasRoute() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">Mesas</h2>
        <p className="text-sm text-ink-400 mt-1">Salón en tiempo real por estado.</p>
      </div>
      <MesasPage />
    </div>
  );
}
