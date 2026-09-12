"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "@/components/theme";
import { ROLE_LABEL } from "@/lib/auth";
import { useModules } from "./ModulesProvider";

const exactTitles: Record<string, string> = {
  "/app": "Inicio",
  "/app/cocina": "Cocina · KDS",
  "/app/mozo": "Mis órdenes",
  "/app/productos/articulos/nuevo": "Nuevo producto",
  "/app/productos/articulos": "Artículo",
  "/app/productos/categorias": "Categorías",
  "/app/productos/modificadores": "Modificadores",
  "/app/productos/precios": "Listas de precios",
  "/app/productos/valorizado": "Valorizado de carta",
  "/app/productos/resumen-categoria": "Resumen por categoría",
  "/app/modulos/whatsapp/plantillas": "Plantillas",
  "/app/modulos/whatsapp/configuracion": "Configuración de mensajes",
  "/app/modulos/whatsapp/historial": "Historial de envíos",
  "/app/modulos/fidelizacion": "Fidelización",
  "/app/clientes": "Clientes",
  "/app/promociones": "Promociones",
  "/app/caja": "Caja",
  "/app/comprobantes": "Comprobantes",
  "/app/gastos": "Gastos",
  "/app/combos": "Combos",
  "/app/menus": "Menús",
  "/app/analiticas": "Analíticas",
  "/app/mesas/maestro": "Mesas",
  "/app/mesas": "Mapa de mesas",
  "/app/modulos/reservas/agenda": "Agenda de reservas",
  "/app/modulos/inventario/stock": "Stock",
  "/app/modulos/inventario/movimientos": "Movimientos de stock",
  "/app/modulos/trabajadores/directorio": "Directorio del equipo",
  "/app/modulos/trabajadores/roles": "Roles",
  "/app/modulos/trabajadores/turnos": "Turnos",
  "/app/modulos/trabajadores/asistencia": "Asistencia",
  "/app/modulos/trabajadores/propinas": "Propinas",
};

const titles: [string, string][] = [
  ["/app/productos", "Maestro de Productos"],
  ["/app/carta", "Carta Virtual"],
  ["/app/ordenes", "Órdenes"],
  ["/app/sitio", "Mi Sitio Web"],
  ["/app/pagos", "Gestión de pagos"],
  ["/app/soporte", "Soporte Técnico"],
  ["/app/configuracion", "Configuración de la cuenta"],
];

function titleFor(pathname: string) {
  if (exactTitles[pathname]) return exactTitles[pathname];
  if (/^\/app\/modulos\/[^/]+$/.test(pathname)) return "Módulo ERP";
  for (const [prefix, title] of titles) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return title;
  }
  return "Panel";
}

function timeAgo(timestamp: number) {
  if (!timestamp) return "Justo ahora";
  const s = Math.floor((Date.now() - timestamp) / 1000);
  if (s < 60) return "Justo ahora";
  const m = Math.floor(s / 60);
  if (m < 60) return `Hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h} h`;
  return `Hace ${Math.floor(h / 24)} d`;
}

export function AppTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { notifications, hasUnread, clearUnread, currentUser, logout } = useModules();
  const { theme, toggle } = useTheme();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [, setTick] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="min-h-16 bg-surface border-b border-ink-900/10 flex items-center gap-3 px-4 sm:px-6 py-2 shrink-0">
      <h1 className="text-sm font-medium text-ink-900 whitespace-nowrap">
        {titleFor(pathname)}
      </h1>

      {/* Buscador global (pegado a la derecha) */}
      <div className="hidden md:flex ml-auto w-full max-w-xs">
        <label className="flex items-center gap-2 w-full px-4 h-10 rounded-full border border-ink-900/15 text-ink-400 focus-within:border-ink-900 transition-colors">
          <Search size={14} className="shrink-0" />
          <input
            type="search"
            placeholder="Buscar platos, pedidos, tickets…"
            className="w-full bg-transparent outline-none text-sm text-ink-900 placeholder:text-ink-400"
          />
          <kbd className="text-xs text-ink-400 border border-ink-900/10 rounded-md px-1.5 py-0.5 shrink-0">
            ⌘K
          </kbd>
        </label>
      </div>

      <div className="flex-1 md:hidden" />

      {/* Tema claro / oscuro */}
      <button
        type="button"
        onClick={toggle}
        aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        className="p-2 text-ink-400 hover:text-ink-900 hover:bg-primary-hover/[0.05] rounded-full transition-colors cursor-pointer"
      >
        {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
      </button>

      {/* Notificaciones */}
      <div className="relative" ref={notifRef}>
        <button
          type="button"
          onClick={() => {
            setNotifOpen(!notifOpen);
            clearUnread();
          }}
          aria-label="Notificaciones"
          className="p-2 text-ink-400 hover:text-ink-900 hover:bg-primary-hover/[0.05] rounded-full transition-colors relative cursor-pointer"
        >
          <Bell size={14} />
          {hasUnread && (
            <span className="absolute top-1 right-1.5 w-2 h-2 bg-primary rounded-full animate-pulse" />
          )}
        </button>

        {notifOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-surface rounded-2xl shadow-xl border border-ink-900/10 overflow-hidden z-50 animate-[fadeIn_0.2s_ease-out]">
            <div className="p-4 border-b border-ink-900/[0.06]">
              <h4 className="font-medium text-sm text-ink-900">Notificaciones</h4>
            </div>
            <div className="max-h-80 overflow-y-auto no-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-ink-400">
                  No tienes notificaciones nuevas.
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="p-4 border-b border-ink-900/[0.04]">
                    <p className="text-sm font-medium text-ink-900 mb-1">{n.title}</p>
                    <p className="text-xs text-ink-600 leading-relaxed mb-2">{n.message}</p>
                    <p className="text-xs text-ink-400">{timeAgo(n.timestamp)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Perfil */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setProfileOpen(!profileOpen)}
          className="flex items-center gap-2 cursor-pointer hover:bg-primary-hover/[0.04] p-1.5 rounded-full transition-colors select-none"
          aria-label="Perfil de usuario"
        >
          <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-medium">
            {currentUser?.initials ?? "??"}
          </span>
        </button>

        {profileOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-ink-900/10 rounded-2xl shadow-lg py-1 z-50">
            <div className="px-4 py-3 border-b border-ink-900/[0.06]">
              <p className="text-sm font-medium text-ink-900">{currentUser?.name ?? "Sin sesión"}</p>
              <p className="text-xs text-ink-400">{currentUser?.email ?? ""}</p>
              {currentUser && (
                <span className="inline-block mt-1.5 text-xs font-medium text-ink-600 bg-primary/[0.06] rounded-md px-2 py-0.5">
                  {ROLE_LABEL[currentUser.role]}
                </span>
              )}
            </div>
            {(currentUser?.role === "admin" || currentUser?.role === "sucursal" || !currentUser) && (
              <>
                <button
                  type="button"
                  className="w-full text-left px-4 py-2 text-sm text-ink-600 hover:bg-primary-hover/[0.04] cursor-pointer"
                  onClick={() => {
                    setProfileOpen(false);
                    router.push("/app/sitio");
                  }}
                >
                  Mi Sitio Web
                </button>
                <button
                  type="button"
                  className="w-full text-left px-4 py-2 text-sm text-ink-600 hover:bg-primary-hover/[0.04] cursor-pointer"
                  onClick={() => {
                    setProfileOpen(false);
                    router.push("/app/configuracion");
                  }}
                >
                  Configuración
                </button>
                <div className="border-t border-ink-900/[0.06] my-1" />
              </>
            )}
            <button
              type="button"
              className="w-full text-left px-4 py-2 text-sm text-ink-900 hover:bg-primary-hover/[0.04] cursor-pointer"
              onClick={() => {
                setProfileOpen(false);
                logout();
                router.push("/");
              }}
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
