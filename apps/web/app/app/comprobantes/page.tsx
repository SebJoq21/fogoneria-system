import { ComprobantesView } from "@/components/erp/ComprobantesView";

export default function ComprobantesPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">Comprobantes</h2>
        <p className="text-sm text-ink-400 mt-1">Boletas y facturas de venta.</p>
      </div>
      <ComprobantesView />
    </div>
  );
}
