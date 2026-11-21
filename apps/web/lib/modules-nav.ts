/**
 * GENERADO por scripts/gen-modules.mjs — no editar a mano.
 * Regenera con `pnpm gen:modules`.
 *
 * AppSidebar consume `modulesNav`; AppTopBar consume `moduleTitles`. Las
 * entradas con `module.ts` salen de la metadata de la feature; el resto y las
 * subrutas, de `modules/catalog.json`.
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
      { href: "/app/auditoria", label: "Auditoría", icon: "ScrollText", roles: ["admin"] },
    ],
  },
];

/** Títulos exactos del topbar (nav + subrutas declaradas en el catálogo). */
export const moduleTitles: Record<string, string> = {
  "/app": "Inicio",
  "/app/auditoria": "Auditoría",
  "/app/productos": "Platos",
  "/app/mesas": "Mapa de mesas",
  "/app/modulos/reservas": "Reservas",
  "/app/ordenes": "Órdenes",
  "/app/cocina": "Cocina · KDS",
  "/app/mozo": "Mis órdenes",
  "/app/caja": "Caja",
  "/app/comprobantes": "Comprobantes",
  "/app/gastos": "Gastos",
  "/app/modulos/inventario": "Inventario",
  "/app/combos": "Combos",
  "/app/promociones": "Promociones",
  "/app/clientes": "Comensales",
  "/app/modulos/fidelizacion": "Fidelización",
  "/app/modulos/personal": "Personal",
  "/app/analiticas": "Analíticas",
  "/": "Acceso",
  "/onboarding": "Alta de restaurante",
  "/saas": "Consola SaaS",
  "/app/productos/precios": "Listas de precios",
  "/app/mesas/maestro": "Maestro de mesas",
  "/app/productos/platos": "Platos",
  "/app/productos/platos/nuevo": "Nuevo plato",
  "/app/productos/categorias": "Categorías",
  "/app/productos/modificadores": "Modificadores",
  "/app/modulos/reservas/agenda": "Agenda de reservas",
  "/app/modulos/inventario/stock": "Stock",
  "/app/modulos/inventario/movimientos": "Movimientos de stock",
  "/app/modulos/personal/directorio": "Directorio del equipo",
  "/app/modulos/personal/roles": "Roles",
  "/app/modulos/personal/turnos": "Turnos",
  "/app/modulos/personal/asistencia": "Asistencia",
  "/app/modulos/personal/propinas": "Propinas",
  "/app/pagos": "Gestión de pagos",
  "/app/soporte": "Soporte Técnico",
  "/app/configuracion": "Configuración de la cuenta",
};
