import {
  CalendarDays,
  Gift,
  MessageCircle,
  Package,
  Users,
} from "lucide-react";
import type { ModuleId } from "@/lib/erp";

export const moduleIcons: Record<ModuleId, typeof MessageCircle> = {
  whatsapp: MessageCircle,
  fidelizacion: Gift,
  reservas: CalendarDays,
  inventario: Package,
  trabajadores: Users,
};
