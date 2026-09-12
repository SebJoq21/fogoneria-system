import { CombosView } from "@/components/erp/CombosView";

export default function CombosPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">Combos</h2>
        <p className="text-sm text-ink-400 mt-1">Paquetes de platos con precio fijo.</p>
      </div>
      <CombosView />
    </div>
  );
}
