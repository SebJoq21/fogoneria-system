import { AnaliticasView } from "@/components/erp/AnaliticasView";

export default function AnaliticasPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">Analíticas</h2>
        <p className="text-sm text-ink-400 mt-1">Ventas, platos top y margen.</p>
      </div>
      <AnaliticasView />
    </div>
  );
}
