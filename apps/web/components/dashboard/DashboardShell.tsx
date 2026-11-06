"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useModules } from "./ModulesProvider";
import { AppSidebar } from "./AppSidebar";
import { AppTopBar } from "./AppTopBar";
import { Toasts } from "@/components/ui/Toast";

import { canSwitchBranch, type AppRole } from "@/lib/auth";

const mobileLinks: { href: string; label: string; roles: AppRole[] }[] = [
  { href: "/app", label: "Inicio", roles: ["admin", "sucursal"] },
  { href: "/app/ordenes", label: "Órdenes", roles: ["admin", "sucursal"] },
  { href: "/app/mesas", label: "Mesas", roles: ["admin", "sucursal"] },
  { href: "/app/productos", label: "Platos", roles: ["admin", "sucursal"] },
  { href: "/app/caja", label: "Caja", roles: ["cajero"] },
  { href: "/app/cocina", label: "Cocina", roles: ["cocina"] },
  { href: "/app/mozo", label: "Mis órdenes", roles: ["mesero"] },
];

function MobileBranchSelect() {
  const { branches, activeBranch, setActiveBranch, currentUser } = useModules();
  if (currentUser && !canSwitchBranch(currentUser.role)) {
    return (
      <span className="px-3 h-10 inline-flex items-center rounded-full text-sm font-medium text-ink-600 border border-ink-900/15 whitespace-nowrap shrink-0">
        {activeBranch.name}
      </span>
    );
  }
  return (
    <select
      value={activeBranch.id}
      onChange={(e) => setActiveBranch(e.target.value)}
      aria-label="Sucursal activa"
      className="px-3 h-10 rounded-full text-sm font-medium bg-surface text-ink-900 border border-ink-900/15 outline-none cursor-pointer shrink-0"
    >
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentUser } = useModules();
  const role = currentUser?.role;
  const links = mobileLinks.filter((l) => !role || l.roles.includes(role));
  // Cocina y Mesero son vista única tipo tablet: sin sidebar ni nav.
  const isTabletView = pathname.startsWith("/app/cocina") || pathname.startsWith("/app/mozo");

  return (
    <div className="flex h-screen bg-surface">
      {!isTabletView && <AppSidebar />}
        <div className="flex-1 flex flex-col overflow-hidden">
          <AppTopBar />
          {/* Nav móvil (oculta en vista tablet: Cocina/Mesero son pantalla única) */}
          {!isTabletView && (
          <nav className="md:hidden flex gap-2 overflow-x-auto no-scrollbar px-4 py-2 border-b border-ink-900/10 bg-surface">
            <MobileBranchSelect />
            {links.map((l) => {
              const active =
                l.href === "/app"
                  ? pathname === l.href
                  : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`px-4 h-10 inline-flex items-center rounded-full text-sm font-medium whitespace-nowrap ${
                    active
                      ? "bg-primary text-white"
                      : "text-ink-600 border border-ink-900/15"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          )}
          <main className="flex-1 overflow-y-auto p-4 no-scrollbar">
            {children}
          </main>
        </div>
      <Toasts />
      </div>
  );
}
