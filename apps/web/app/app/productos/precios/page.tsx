import { PriceListsView } from "@/components/erp/catalog/PriceListsView";

export default function PreciosPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">Listas de precios</h2>
        <p className="text-sm text-ink-400 mt-1">
          Carta, Delivery y Eventos con vigencia por lista.
        </p>
      </div>
      <PriceListsView />
    </div>
  );
}
