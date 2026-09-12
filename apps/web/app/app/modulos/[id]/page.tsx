import { MODULE_CATALOG } from "@/lib/erp";
import { ModuleBody } from "@/components/dashboard/ModuleGate";

export function generateStaticParams() {
  return MODULE_CATALOG.map((m) => ({ id: m.id }));
}

export default async function ModulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ModuleBody id={id} />;
}
