"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme";
import { ROLE_LABEL } from "@/lib/auth";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useModules } from "./ModulesProvider";

const exactTitles: Record<string, string> = {
  "/app": "Inicio",
  "/app/cocina": "Cocina · KDS",
  "/app/mozo": "Mis órdenes",
  "/app/productos/platos/nuevo": "Nuevo plato",
  "/app/productos/platos": "Platos",
  "/app/productos/categorias": "Categorías",
  "/app/productos/modificadores": "Modificadores",
  "/app/productos/precios": "Listas de precios",
  "/app/productos/valorizado": "Valorizado de carta",
  "/app/productos/resumen-categoria": "Resumen por categoría",
  "/app/modulos/fidelizacion": "Fidelización",
  "/app/clientes": "Comensales",
  "/app/promociones": "Promociones",
  "/app/caja": "Caja",
  "/app/comprobantes": "Comprobantes",
  "/app/gastos": "Gastos",
  "/app/combos": "Combos",
  "/app/analiticas": "Analíticas",
  "/app/mesas/maestro": "Maestro de mesas",
  "/app/mesas": "Mapa de mesas",
  "/app/modulos/reservas/agenda": "Agenda de reservas",
  "/app/modulos/inventario/stock": "Stock",
  "/app/modulos/inventario/movimientos": "Movimientos de stock",
  "/app/modulos/personal/directorio": "Directorio del equipo",
  "/app/modulos/personal/roles": "Roles",
  "/app/modulos/personal/turnos": "Turnos",
  "/app/modulos/personal/asistencia": "Asistencia",
  "/app/modulos/personal/propinas": "Propinas",
};

const titles: [string, string][] = [
  ["/app/productos", "Platos"],
  ["/app/ordenes", "Órdenes"],
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

export function AppTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logout, resetDemoData, notify } = useModules();
  const { theme, toggle } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const [pendingReset, setPendingReset] = useState(false);

  return (
    <header className="min-h-16 bg-surface border-b border-ink-900/10 flex items-center gap-3 px-4 sm:px-6 py-2 shrink-0">
      <h1 className="text-sm font-medium text-ink-900 whitespace-nowrap">
        {titleFor(pathname)}
      </h1>

      <div className="flex-1" />

      {/* Tema claro / oscuro */}
      <button
        type="button"
        onClick={toggle}
        aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        className="p-2 text-ink-400 hover:text-ink-900 hover:bg-primary-hover/[0.05] rounded-full transition-colors cursor-pointer"
      >
        {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
      </button>

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
                    router.push("/app/configuracion");
                  }}
                >
                  Configuración
                </button>
                <div className="border-t border-ink-900/[0.06] my-1" />
              </>
            )}
            <div className="border-t border-ink-900/[0.06] my-1" />
            <button
              type="button"
              className="w-full text-left px-4 py-2 text-sm text-ink-600 hover:bg-primary-hover/[0.04] cursor-pointer"
              onClick={() => {
                setProfileOpen(false);
                setPendingReset(true);
              }}
            >
              Reiniciar datos demo
            </button>
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

      <ConfirmDialog
        open={pendingReset}
        title="Reiniciar datos demo"
        message="¿Volver al estado inicial? Se perderán cuentas, ventas y cambios guardados en este navegador."
        confirmLabel="Reiniciar"
        danger
        onConfirm={() => {
          resetDemoData();
          notify("Datos reiniciados", "La demo volvió a su estado inicial.");
          setPendingReset(false);
        }}
        onCancel={() => setPendingReset(false)}
      />
    </header>
  );
}
