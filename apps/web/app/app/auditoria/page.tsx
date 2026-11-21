import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuditPage } from "@/features/audit";
import { canViewPath } from "@/lib/auth";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export default async function AuditoriaRoute() {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session || !canViewPath("/app/auditoria", session.role)) {
    redirect("/");
  }

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
