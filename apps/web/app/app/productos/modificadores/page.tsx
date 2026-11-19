import { ModifiersView } from "@/features/catalogo";

export default function ModificadoresPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">Modificadores</h2>
        <p className="text-sm text-ink-400 mt-1">
          Tamaños, extras y opciones con precio adicional.
        </p>
      </div>
      <ModifiersView />
    </div>
  );
}
