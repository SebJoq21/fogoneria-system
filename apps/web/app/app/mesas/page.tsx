import { BookingsModule } from "@/components/erp/BookingsModule";

export default function MesasPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">Mesas</h2>
        <p className="text-sm text-ink-400 mt-1">Salón en tiempo real por estado.</p>
      </div>
      <BookingsModule view="mapa" />
    </div>
  );
}
