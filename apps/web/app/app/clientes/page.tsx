import { ClientesView } from "@/components/erp/ClientesView";

export default function ClientesPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">Clientes</h2>
        <p className="text-sm text-ink-400 mt-1">Base de comensales con puntos y segmento.</p>
      </div>
      <ClientesView />
    </div>
  );
}
