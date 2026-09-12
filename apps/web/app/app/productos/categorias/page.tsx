import { CategoriesView } from "@/components/erp/catalog/CategoriesView";

export default function CategoriasPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">Categorías</h2>
        <p className="text-sm text-ink-400 mt-1">Agrupan la carta y ordenan el maestro.</p>
      </div>
      <CategoriesView />
    </div>
  );
}
