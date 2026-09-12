import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SalonTablesView } from "@/components/erp/SalonTablesView";
import type { AppRole } from "@/lib/auth";

export default async function MesasMaestroPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get("fogoneria.role")?.value as AppRole | undefined;
  if (role === "admin") redirect("/app/mesas");
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">Maestro de mesas</h2>
        <p className="text-sm text-ink-400 mt-1">Estructura del salón: el mapa la refleja al instante.</p>
      </div>
      <SalonTablesView />
    </div>
  );
}
