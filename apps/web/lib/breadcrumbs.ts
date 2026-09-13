import type { Crumb } from "@/components/ui/Breadcrumb";

/** Tramos exactos por ruta (revisar junto a AppTopBar al renombrar). */
const exactTrails: Record<string, Crumb[]> = {
  "/app": [{ label: "Inicio" }],
  "/app/mesas": [{ label: "Inicio", href: "/app" }, { label: "Mesas" }],
  "/app/mesas/maestro": [
    { label: "Inicio", href: "/app" },
    { label: "Mesas", href: "/app/mesas" },
    { label: "Maestro de mesas" },
  ],
  "/app/ordenes": [{ label: "Inicio", href: "/app" }, { label: "Órdenes" }],
  "/app/cocina": [{ label: "Inicio", href: "/app" }, { label: "Cocina" }],
  "/app/mozo": [{ label: "Inicio", href: "/app" }, { label: "Mis órdenes" }],
  "/app/caja": [{ label: "Inicio", href: "/app" }, { label: "Caja" }],
  "/app/comprobantes": [{ label: "Inicio", href: "/app" }, { label: "Comprobantes" }],
  "/app/combos": [{ label: "Inicio", href: "/app" }, { label: "Combos" }],
  "/app/promociones": [{ label: "Inicio", href: "/app" }, { label: "Promociones" }],
  "/app/clientes": [{ label: "Inicio", href: "/app" }, { label: "Comensales" }],
  "/app/gastos": [{ label: "Inicio", href: "/app" }, { label: "Gastos" }],
  "/app/analiticas": [{ label: "Inicio", href: "/app" }, { label: "Analíticas" }],
  "/app/pagos": [{ label: "Inicio", href: "/app" }, { label: "Pagos" }],
  "/app/soporte": [{ label: "Inicio", href: "/app" }, { label: "Soporte" }],
  "/app/configuracion": [{ label: "Inicio", href: "/app" }, { label: "Configuración" }],
  "/app/productos": [{ label: "Inicio", href: "/app" }, { label: "Platos" }],
  "/app/productos/platos": [
    { label: "Inicio", href: "/app" },
    { label: "Platos", href: "/app/productos" },
    { label: "Maestro" },
  ],
  "/app/productos/platos/nuevo": [
    { label: "Inicio", href: "/app" },
    { label: "Platos", href: "/app/productos" },
    { label: "Nuevo plato" },
  ],
  "/app/productos/categorias": [
    { label: "Inicio", href: "/app" },
    { label: "Platos", href: "/app/productos" },
    { label: "Categorías" },
  ],
  "/app/productos/modificadores": [
    { label: "Inicio", href: "/app" },
    { label: "Platos", href: "/app/productos" },
    { label: "Modificadores" },
  ],
  "/app/productos/precios": [
    { label: "Inicio", href: "/app" },
    { label: "Platos", href: "/app/productos" },
    { label: "Listas de precios" },
  ],
  "/app/productos/valorizado": [
    { label: "Inicio", href: "/app" },
    { label: "Platos", href: "/app/productos" },
    { label: "Valorizado de carta" },
  ],
  "/app/productos/resumen-categoria": [
    { label: "Inicio", href: "/app" },
    { label: "Platos", href: "/app/productos" },
    { label: "Resumen por categoría" },
  ],
  "/app/modulos/reservas": [{ label: "Inicio", href: "/app" }, { label: "Reservas" }],
  "/app/modulos/reservas/agenda": [
    { label: "Inicio", href: "/app" },
    { label: "Reservas", href: "/app/modulos/reservas" },
    { label: "Agenda" },
  ],
  "/app/modulos/inventario": [{ label: "Inicio", href: "/app" }, { label: "Inventario" }],
  "/app/modulos/inventario/stock": [
    { label: "Inicio", href: "/app" },
    { label: "Inventario", href: "/app/modulos/inventario" },
    { label: "Stock" },
  ],
  "/app/modulos/inventario/movimientos": [
    { label: "Inicio", href: "/app" },
    { label: "Inventario", href: "/app/modulos/inventario" },
    { label: "Movimientos" },
  ],
  "/app/modulos/personal": [{ label: "Inicio", href: "/app" }, { label: "Personal" }],
  "/app/modulos/personal/directorio": [
    { label: "Inicio", href: "/app" },
    { label: "Personal", href: "/app/modulos/personal" },
    { label: "Directorio" },
  ],
  "/app/modulos/personal/roles": [
    { label: "Inicio", href: "/app" },
    { label: "Personal", href: "/app/modulos/personal" },
    { label: "Roles" },
  ],
  "/app/modulos/personal/turnos": [
    { label: "Inicio", href: "/app" },
    { label: "Personal", href: "/app/modulos/personal" },
    { label: "Turnos" },
  ],
  "/app/modulos/personal/asistencia": [
    { label: "Inicio", href: "/app" },
    { label: "Personal", href: "/app/modulos/personal" },
    { label: "Asistencia" },
  ],
  "/app/modulos/personal/propinas": [
    { label: "Inicio", href: "/app" },
    { label: "Personal", href: "/app/modulos/personal" },
    { label: "Propinas" },
  ],
  "/app/modulos/fidelizacion": [{ label: "Inicio", href: "/app" }, { label: "Fidelización" }],
  "/app/modulos/fidelizacion/regla": [
    { label: "Inicio", href: "/app" },
    { label: "Fidelización", href: "/app/modulos/fidelizacion" },
    { label: "Regla de puntos" },
  ],
};

/** Prefijos de respaldo para rutas de módulo no listadas. */
const moduleFallback: [string, string][] = [
  ["/app/modulos/reservas", "Reservas"],
  ["/app/modulos/inventario", "Inventario"],
  ["/app/modulos/personal", "Personal"],
  ["/app/modulos/fidelizacion", "Fidelización"],
];

/** Tramos Inicio / Sección / Subfunción para el pathname actual. */
export function trailFor(pathname: string): Crumb[] {
  if (exactTrails[pathname]) return exactTrails[pathname];
  for (const [prefix, label] of moduleFallback) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return [
        { label: "Inicio", href: "/app" },
        { label },
      ];
    }
  }
  if (pathname === "/" || !pathname.startsWith("/app")) return [];
  return [{ label: "Inicio", href: "/app" }];
}
