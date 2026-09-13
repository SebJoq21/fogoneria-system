"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";

type Company = {
  id: string;
  name: string;
  ruc: string;
  plan: string;
  branches: number;
  mrr: string;
  status: "Activa" | "Suspendida" | "Trial";
};

const initialCompanies: Company[] = [
  { id: "c1", name: "Mi Restaurante S.A.C.", ruc: "20123456789", plan: "Profesional", branches: 3, mrr: "$70.00", status: "Activa" },
  { id: "c2", name: "Café Express S.A.C.", ruc: "20555444333", plan: "Básico", status: "Activa", branches: 1, mrr: "$40.00" },
  { id: "c3", name: "Pizzería La Nonna S.A.C.", ruc: "20999888777", plan: "Trial", status: "Suspendida", branches: 1, mrr: "$0.00" },
];

/** Consola SaaS del superadmin: empresas, planes y estado. Fuera del shell restaurante. */
export default function SaasPage() {
  const router = useRouter();
  const { currentUser, logout, notify } = useModules();
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);

  const toggle = (id: string) => {
    setCompanies((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = c.status === "Suspendida" ? "Activa" : "Suspendida";
        notify(`Empresa ${next === "Activa" ? "reactivada" : "suspendida"}`, c.name);
        return { ...c, status: next } as Company;
      }),
    );
  };

  return (
    <div className="min-h-screen bg-surface">
      <header className="h-16 bg-surface border-b border-ink-900/10 flex items-center justify-between px-4 sm:px-6 shrink-0">
        <span className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center">
            <Flame size={20} strokeWidth={2} />
          </span>
          <span className="text-sm font-medium text-ink-900">Fogonería · SaaS</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="text-nav text-ink-600 hidden sm:block">
            {currentUser?.name ?? "Superadmin"}
          </span>
          <button
            type="button"
            onClick={() => {
              logout();
              router.push("/");
            }}
            className="px-4 h-10 rounded-full text-nav font-medium text-ink-600 border border-ink-900/15 hover:border-ink-900 transition-colors cursor-pointer"
          >
            Cerrar sesión
          </button>
        </span>
      </header>

      <main className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <h2 className="text-display font-medium text-ink-900">Empresas</h2>
          <p className="text-sm text-ink-400 mt-1">Tenants que adquirieron Fogonería como SaaS.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard label="MRR total" value="$110.00" hint="suscripciones activas" />
          <KpiCard label="Empresas" value={String(companies.length)} hint="2 activas · 1 suspendida" />
          <KpiCard label="Sucursales" value="5" hint="en todos los tenants" />
          <KpiCard label="Usuarios" value="14" hint="todos los roles" />
        </div>

        <TableCard>
          <THead>
            <tr>
              <TH>Empresa</TH>
              <TH>RUC</TH>
              <TH>Plan</TH>
              <TH>Sucursales</TH>
              <TH>MRR</TH>
              <TH>Estado</TH>
              <TH right>Acciones</TH>
            </tr>
          </THead>
          <tbody>
            {companies.map((c) => (
              <TR key={c.id}>
                <TD tone="strong">{c.name}</TD>
                <TD tone="muted" nowrap>
                  <span className="text-nav">{c.ruc}</span>
                </TD>
                <TD>{c.plan}</TD>
                <TD className="tnum">{c.branches}</TD>
                <TD tone="strong" nowrap className="tnum">{c.mrr}</TD>
                <TD>
                  <Badge
                    tone={c.status === "Activa" ? "success" : c.status === "Trial" ? "warning" : "danger"}
                    dot
                  >
                    {c.status}
                  </Badge>
                </TD>
                <TD right nowrap>
                  <button
                    type="button"
                    onClick={() => toggle(c.id)}
                    className="text-ink-900 hover:underline font-medium text-nav cursor-pointer"
                  >
                    {c.status === "Suspendida" ? "Reactivar" : "Suspender"}
                  </button>
                </TD>
              </TR>
            ))}
          </tbody>
        </TableCard>
      </main>
    </div>
  );
}
