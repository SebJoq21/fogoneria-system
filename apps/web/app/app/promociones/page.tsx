import { PromocionesView } from "@/components/erp/PromocionesView";

export default function PromocionesPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">Promociones</h2>
        <p className="text-sm text-ink-400 mt-1">Cupones con cupo y promociones por horario.</p>
      </div>
      <PromocionesView />
    </div>
  );
}
