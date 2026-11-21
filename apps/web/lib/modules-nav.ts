/**
 * GENERADO por scripts/gen-modules.mjs — no editar a mano.
 * Regenera con `pnpm gen:modules`.
 *
 * El shell todavía usa su lista de AppSidebar (Fase 6 conectará este nav).
 * Fase 1: la entrada de `crm` sale de `features/crm/module.ts`.
 */
export type ModuleNavRole = 'superadmin' | 'admin' | 'sucursal' | 'cajero' | 'cocina' | 'mesero';

export type ModuleNavEntry = {
  href: string;
  label: string;
  icon: string;
  roles: ModuleNavRole[];
  exact?: boolean;
};

export type ModuleNavGroup = {
  label: string;
  entries: ModuleNavEntry[];
};

export const modulesNav: ModuleNavGroup[] = [
  {
    label: "Principal",
    entries: [
      { href: "/app", label: "Inicio", icon: "House", roles: ["admin","sucursal"], exact: true },
      { href: "/app/mesas", label: "Mesas", icon: "Armchair", roles: ["admin","sucursal"] },
      { href: "/app/ordenes", label: "Órdenes", icon: "ReceiptText", roles: ["admin","sucursal"] },
      { href: "/app/cocina", label: "Cocina", icon: "ChefHat", roles: ["cocina"] },
      { href: "/app/mozo", label: "Mis órdenes", icon: "ClipboardList", roles: ["mesero"] },
      { href: "/app/caja", label: "Caja", icon: "Banknote", roles: ["admin","sucursal","cajero"] },
    ],
  },
  {
    label: "Carta",
    entries: [
      { href: "/app/productos", label: "Platos", icon: "Package", roles: ["admin","sucursal"] },
      { href: "/app/combos", label: "Combos", icon: "PackagePlus", roles: ["admin","sucursal"] },
      { href: "/app/promociones", label: "Promociones", icon: "BadgePercent", roles: ["admin","sucursal"] },
    ],
  },
  {
    label: "Clientes",
    entries: [
      { href: "/app/clientes", label: "Comensales", icon: "Users", roles: ["admin","sucursal"] },
      { href: "/app/modulos/reservas", label: "Reservas", icon: "CalendarDays", roles: ["admin","sucursal"] },
      { href: "/app/modulos/fidelizacion", label: "Fidelización", icon: "Gift", roles: ["admin","sucursal"] },
    ],
  },
  {
    label: "Administración",
    entries: [
      { href: "/app/comprobantes", label: "Comprobantes", icon: "Receipt", roles: ["admin","sucursal","cajero"] },
      { href: "/app/modulos/inventario", label: "Inventario", icon: "Warehouse", roles: ["admin","sucursal"] },
      { href: "/app/gastos", label: "Gastos", icon: "TrendingDown", roles: ["admin","sucursal"] },
      { href: "/app/modulos/personal", label: "Personal", icon: "Contact", roles: ["admin","sucursal"] },
      { href: "/app/analiticas", label: "Analíticas", icon: "ChartColumn", roles: ["admin","sucursal"] },
    ],
  },
];
