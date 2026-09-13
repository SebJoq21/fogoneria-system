import {
  CalendarDays,
  Gift,
  Package,
  Users,
} from "lucide-react";
import type { ModuleId } from "@/lib/erp";

export const moduleIcons: Record<ModuleId, typeof Gift> = {
  fidelizacion: Gift,
  reservas: CalendarDays,
  inventario: Package,
  personal: Users,
};
