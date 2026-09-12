"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown, LayoutGrid } from "lucide-react";
import { canSwitchBranch } from "@/lib/auth";
import { useModules } from "./ModulesProvider";

/** Switcher multitenant: 1 RUC → N sucursales, cada una con su operación. */
export function BranchSwitcher() {
  const { company, branches, activeBranch, setActiveBranch, notify, currentUser } = useModules();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Solo el dueño cambia de sucursal; el resto opera fija en la suya.
  if (currentUser && !canSwitchBranch(currentUser.role)) {
    return (
      <div className="rounded-2xl border border-ink-900/10 p-3">
        <p className="text-xs text-ink-400 truncate">
          {company.legalName} · RUC {company.ruc}
        </p>
        <span className="flex items-center gap-2 mt-1">
          <Building2 size={14} className="text-ink-900 shrink-0" />
          <span className="text-sm font-medium text-ink-900 leading-tight truncate">
            {activeBranch.name}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Cambiar de sucursal"
        className="w-full rounded-2xl border border-ink-900/10 p-3 text-left hover:border-ink-900/30 transition-colors cursor-pointer"
      >
        <p className="text-xs text-ink-400 truncate">
          {company.legalName} · RUC {company.ruc}
        </p>
        <span className="flex items-center gap-2 mt-1">
          {activeBranch.id === "todas" ? (
            <LayoutGrid size={14} className="text-ink-900 shrink-0" />
          ) : (
            <Building2 size={14} className="text-ink-900 shrink-0" />
          )}
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-ink-900 leading-tight truncate">
              {activeBranch.name}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-ink-400">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  activeBranch.status === "Abierta" ? "bg-emerald-500 animate-pulse" : "bg-ink-400"
                }`}
              />
              {activeBranch.status}
            </span>
          </span>
          <ChevronDown
            size={14}
            className={`text-ink-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-surface border border-ink-900/10 rounded-2xl shadow-lg py-1 z-50 animate-[fadeIn_0.1s_ease-out]">
          {branches.map((b) => {
            const current = b.id === activeBranch.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (!current) {
                    setActiveBranch(b.id);
                    notify("Sucursal cambiada", `Ahora operas en ${b.name}.`);
                  }
                }}
                className={`w-full text-left px-4 py-2.5 transition-colors cursor-pointer ${
                  current ? "bg-primary/[0.06]" : "hover:bg-primary-hover/[0.04]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
                      <span className="truncate">{b.name}</span>
                      {b.isMain && (
                        <span className="text-xs font-medium text-ink-400 border border-ink-900/15 rounded-md px-1.5 py-0.5 shrink-0">
                          Matriz
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-ink-400 truncate mt-0.5">{b.address}</span>
                  </span>
                  {current && <Check size={14} className="text-ink-900 shrink-0" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
