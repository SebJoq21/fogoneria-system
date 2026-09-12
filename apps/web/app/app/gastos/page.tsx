import { GastosView } from "@/components/erp/GastosView";

export default function GastosPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">Gastos</h2>
        <p className="text-sm text-ink-400 mt-1">Egresos operativos por categoría.</p>
      </div>
      <GastosView />
    </div>
  );
}
