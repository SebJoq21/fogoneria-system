import { CajaView } from "@/components/erp/CajaView";

export default function CajaPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">Caja</h2>
        <p className="text-sm text-ink-400 mt-1">Saldo del turno, movimientos y cierre.</p>
      </div>
      <CajaView />
    </div>
  );
}
