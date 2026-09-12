"use client";

import { notFound } from "next/navigation";
import { MODULE_CATALOG, type ModuleId } from "@/lib/erp";
import { WhatsappWorkspace } from "@/components/erp/WhatsappWorkspace";
import { LoyaltyWorkspace } from "@/components/erp/LoyaltyWorkspace";
import { BookingsWorkspace } from "@/components/erp/BookingsWorkspace";
import { InventoryWorkspace } from "@/components/erp/InventoryWorkspace";
import { StaffWorkspace } from "@/components/erp/StaffWorkspace";

export function moduleMeta(id: string) {
  const meta = MODULE_CATALOG.find((m) => m.id === (id as ModuleId));
  if (!meta) notFound();
  return meta;
}

/** Sin paywalls: todos los módulos son base. Se conserva el guard por compatibilidad. */
export function ModuleGuard({
  children,
}: {
  children: React.ReactNode;
  id?: string;
}) {
  return <>{children}</>;
}

/** Cuerpo por defecto de cada módulo (su vista principal). */
export function ModuleBody({ id }: { id: string }) {
  const meta = moduleMeta(id);
  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <div className="mb-6">
        <h2 className="text-section font-medium text-ink-900">{meta.title}</h2>
        <p className="text-sm text-ink-400 mt-1">{meta.description}</p>
      </div>
      {meta.id === "whatsapp" && <WhatsappWorkspace />}
      {meta.id === "fidelizacion" && <LoyaltyWorkspace />}
      {meta.id === "reservas" && <BookingsWorkspace />}
      {meta.id === "inventario" && <InventoryWorkspace />}
      {meta.id === "trabajadores" && <StaffWorkspace />}
    </div>
  );
}
