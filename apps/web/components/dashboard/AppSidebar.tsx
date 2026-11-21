"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame } from "lucide-react";
import { BranchSwitcher } from "@/features/tenant";
import { modulesNav, type ModuleNavRole } from "@/lib/modules-nav";
import { moduleIcon } from "./module-icons";
import { useModules } from "./ModulesProvider";

/**
 * Sidebar generada desde `lib/modules-nav.ts` (Fase 6): grupos, etiquetas,
 * iconos, rutas y roles vienen del catálogo/`module.ts`. No editar listas aquí.
 */
const itemCls = (active: boolean) =>
  `w-full text-left px-3 py-1.5 rounded-xl flex items-center gap-2.5 text-sm font-medium transition-colors cursor-pointer ${
    active ? "bg-primary/[0.06] text-ink-900" : "text-ink-600 hover:bg-primary-hover/[0.04]"
  }`;

export function AppSidebar() {
  const pathname = usePathname();
  const { currentUser } = useModules();
  const role = currentUser?.role as ModuleNavRole | undefined;

  const visible = (entry: (typeof modulesNav)[number]["entries"][number]) =>
    !role || entry.roles.includes(role);

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="w-64 shrink-0 bg-surface border-r border-ink-900/10 hidden md:flex flex-col h-full">
      <div className="p-4 pb-3">
        <Link href="/app" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center">
            <Flame size={20} strokeWidth={2} />
          </span>
          <span className="text-sm font-medium text-ink-900">Fogonería</span>
        </Link>
      </div>

      <div className="px-4 pb-3">
        <BranchSwitcher />
      </div>

      <nav className="flex-1 overflow-y-auto thin-scroll px-3 pb-4">
        {modulesNav.map((group) => {
          const shown = group.entries.filter(visible);
          if (shown.length === 0) return null;
          return (
            <div key={group.label} className="pb-5">
              <p className="px-3 mt-5 mb-3 text-xs font-medium uppercase tracking-wider text-ink-400 first:mt-0">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {shown.map((entry) => {
                  const Icon = moduleIcon(entry.icon);
                  return (
                    <Link
                      key={entry.href}
                      href={entry.href}
                      className={itemCls(isActive(entry.href, entry.exact))}
                    >
                      <Icon size={16} className="shrink-0" />
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
