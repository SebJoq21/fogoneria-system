import { AuditPage } from "@/features/audit";

export default function AuditoriaRoute() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">Auditoría</h2>
        <p className="text-sm text-ink-400 mt-1">
          Últimos eventos sensibles de la empresa. Solo lectura.
        </p>
      </div>
      <AuditPage />
    </div>
  );
}
