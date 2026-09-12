import { MenusView } from "@/components/erp/MenusView";

export default function MenusPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">Menús</h2>
        <p className="text-sm text-ink-400 mt-1">Menús publicados por horario.</p>
      </div>
      <MenusView />
    </div>
  );
}
