import {
  Armchair,
  BadgePercent,
  Banknote,
  CalendarDays,
  ChartColumn,
  ChefHat,
  Circle,
  ClipboardList,
  Contact,
  Gift,
  House,
  Package,
  PackagePlus,
  Receipt,
  ReceiptText,
  ScrollText,
  TrendingDown,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

/**
 * El nav generado guarda el nombre del icono (`modules-nav.ts`) para no acoplar
 * el generador a React. El shell lo resuelve aquí; si un módulo nuevo usa un
 * icono no listado, cae a `Circle` hasta agregarlo.
 */
const ICONS: Record<string, LucideIcon> = {
  Armchair,
  BadgePercent,
  Banknote,
  CalendarDays,
  ChartColumn,
  ChefHat,
  ClipboardList,
  Contact,
  Gift,
  House,
  Package,
  PackagePlus,
  Receipt,
  ReceiptText,
  ScrollText,
  TrendingDown,
  Users,
  Warehouse,
};

export function moduleIcon(name: string): LucideIcon {
  return ICONS[name] ?? Circle;
}
