"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Armchair,
  BadgePercent,
  Banknote,
  BookOpenText,
  CalendarDays,
  ChartColumn,
  ChefHat,
  ClipboardList,
  Contact,
  Flame,
  Gift,
  House,
  Package,
  PackagePlus,
  Receipt,
  ReceiptText,
  TrendingDown,
  Users,
  Warehouse,
} from "lucide-react";
import { BranchSwitcher } from "./BranchSwitcher";
import { useModules } from "./ModulesProvider";
import type { AppRole } from "@/lib/auth";

type Entry = {
  href: string;
  label: string;
  icon: typeof House;
  exact?: boolean;
  roles: AppRole[];
};
type Group = { label: string; entries: Entry[] };

/** Sidebar BMS: Principal (operación del salón) + Gestión (administración).
 *  Cada entrada declara qué roles la ven (cocina/mozo solo ven su panel). */
const STAFF: AppRole[] = ["admin", "sucursal"];
const groups: Group[] = [
  {
    label: "Principal",
    entries: [
      { href: "/app", label: "Inicio", icon: House, exact: true, roles: STAFF },
      { href: "/app/mesas", label: "Mesas", icon: Armchair, roles: STAFF },
      { href: "/app/ordenes", label: "Órdenes", icon: ReceiptText, roles: STAFF },
      { href: "/app/carta", label: "Carta", icon: BookOpenText, roles: STAFF },
      { href: "/app/cocina", label: "Cocina", icon: ChefHat, roles: ["cocina", "admin", "sucursal"] },
      { href: "/app/mozo", label: "Mis órdenes", icon: ClipboardList, roles: ["mesero", "admin", "sucursal"] },
    ],
  },
  {
    label: "Gestión",
    entries: [
      { href: "/app/caja", label: "Caja", icon: Banknote, roles: STAFF },
      { href: "/app/comprobantes", label: "Comprobantes", icon: Receipt, roles: STAFF },
      { href: "/app/modulos/inventario", label: "Inventario", icon: Warehouse, roles: STAFF },
      { href: "/app/combos", label: "Combos", icon: PackagePlus, roles: STAFF },
      { href: "/app/promociones", label: "Promociones", icon: BadgePercent, roles: STAFF },
      { href: "/app/clientes", label: "Clientes", icon: Users, roles: STAFF },
      { href: "/app/modulos/reservas", label: "Reservas", icon: CalendarDays, roles: STAFF },
      { href: "/app/gastos", label: "Gastos", icon: TrendingDown, roles: STAFF },
      { href: "/app/analiticas", label: "Analíticas", icon: ChartColumn, roles: STAFF },
      { href: "/app/modulos/trabajadores", label: "Personal", icon: Contact, roles: STAFF },
      { href: "/app/productos", label: "Platos", icon: Package, roles: STAFF },
      { href: "/app/modulos/fidelizacion", label: "Fidelización", icon: Gift, roles: STAFF },
    ],
  },
];

const itemCls = (active: boolean) =>
  `w-full text-left px-2 py-2 rounded-lg flex items-center gap-2 text-nav font-medium transition-colors cursor-pointer ${
    active ? "bg-primary/[0.06] text-ink-900" : "text-ink-600 hover:bg-primary-hover/[0.04]"
  }`;

export function AppSidebar() {
  const pathname = usePathname();
  const { currentUser } = useModules();
  const role = currentUser?.role;

  const visible = (entry: Entry) => !role || entry.roles.includes(role);

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="w-64 shrink-0 bg-surface border-r border-ink-900/10 hidden md:flex flex-col h-full">
      {/* Cabecera: isotipo + nombre */}
      <div className="p-4 pb-3">
        <Link href="/app" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center">
            <Flame size={20} strokeWidth={2} />
          </span>
          <span className="text-sm font-medium text-ink-900">Fogonería</span>
        </Link>
      </div>

      {/* Sucursal activa: RUC con N locales */}
      <div className="px-4 pb-3">
        <BranchSwitcher />
      </div>

      <nav className="flex-1 overflow-y-auto thin-scroll px-2 pb-2">
        {groups.map((group) => {
          const shown = group.entries.filter(visible);
          if (shown.length === 0) return null;
          return (
          <div key={group.label}>
            <p className="px-2 mt-4 mb-1 text-xs font-medium uppercase text-ink-400 first:mt-0">
              {group.label}
            </p>
            <div className="flex flex-col gap-1">
              {shown.map((entry) => {
                const Icon = entry.icon;
                return (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    className={itemCls(isActive(entry.href, entry.exact))}
                  >
                    <Icon size={14} className="shrink-0" />
                    <span className="flex-1 truncate">{entry.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
          );
        })}
      </nav>
    </aside>
  );
}
