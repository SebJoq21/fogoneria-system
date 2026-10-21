"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { KpiCard } from "@/components/ui/KpiCard";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ApiError } from "@/lib/api";
import {
  fetchMetrics,
  fetchTenants,
  reactivateTenant,
  suspendTenant,
  type SaasMetrics,
  type SaasTenant,
} from "@/lib/saas-api";

type CompanyStatus = "Activa" | "Suspendida" | "Trial" | "Expirada" | "Lead";

type Company = {
  id: string;
  name: string;
  ruc: string;
  plan: string;
  branches: number;
  mrr: string;
  status: CompanyStatus;
};

const PLAN_LABEL: Record<SaasTenant["plan_actual"], string> = {
  TRIAL: "Trial",
  BASICO: "Básico",
  PROFESIONAL: "Profesional",
};

const STATUS_LABEL: Record<SaasTenant["estado"], CompanyStatus> = {
  ACTIVE: "Activa",
  TRIAL: "Trial",
  SUSPENDED: "Suspendida",
  EXPIRED: "Expirada",
  LEAD: "Lead",
  NO_CALIFICADO: "Lead",
};

const EMPTY_METRICS: SaasMetrics = {
  empresas: { total: 0, trial: 0, active: 0, suspended: 0, expired: 0 },
  mrr: 0,
};

function toCompany(tenant: SaasTenant): Company {
  return {
    id: tenant.id,
    name: tenant.nombre_comercial ?? tenant.nombre_legal,
    ruc: tenant.ruc,
    plan: PLAN_LABEL[tenant.plan_actual],
    branches: tenant._count.sucursales,
    mrr: `$${Number(tenant.mrr_monto).toFixed(2)}`,
    status: STATUS_LABEL[tenant.estado],
  };
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "No se pudo cargar la consola SaaS.";
}

/** Consola SaaS del superadmin: empresas, planes y estado. Fuera del shell restaurante. */
export default function SaasPage() {
  const { currentUser, logout, notify } = useModules();
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [metrics, setMetrics] = useState<SaasMetrics>(EMPTY_METRICS);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Company | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchTenants(), fetchMetrics()])
      .then(([list, kpis]) => {
        if (cancelled) return;
        setCompanies(list.items.map(toCompany));
        setMetrics(kpis);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (company: Company) => {
    const suspender = company.status !== "Suspendida";
    setPendingId(company.id);
    try {
      const updated = suspender
        ? await suspendTenant(company.id, "Suspensión manual desde consola SaaS")
        : await reactivateTenant(company.id, "Reactivación manual desde consola SaaS");
      setCompanies((prev) =>
        prev
          ? prev.map((item) => (item.id === company.id ? toCompany(updated) : item))
          : prev,
      );
      notify(
        `Empresa ${suspender ? "suspendida" : "reactivada"}`,
        company.name,
      );
      const kpis = await fetchMetrics();
      setMetrics(kpis);
    } catch (err) {
      notify("No se pudo actualizar la empresa", errorMessage(err));
    } finally {
      setPendingId(null);
    }
  };

  const totalEmpresas = companies?.length ?? metrics.empresas.total;
  const activas = metrics.empresas.active;
  const suspendidas = metrics.empresas.suspended;

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
            onClick={() => logout()}
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
          <KpiCard label="MRR total" value={`$${metrics.mrr.toFixed(2)}`} hint="suscripciones activas" />
          <KpiCard
            label="Empresas"
            value={String(totalEmpresas)}
            hint={`${activas} activas · ${suspendidas} suspendidas`}
          />
          <KpiCard
            label="Sucursales"
            value={String(
              companies?.reduce((total, company) => total + company.branches, 0) ?? 0,
            )}
            hint="en todos los tenants"
          />
          <KpiCard
            label="Trial"
            value={String(metrics.empresas.trial)}
            hint="empresas en prueba"
          />
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

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
            {companies === null ? (
              <TR>
                <TD tone="muted" colSpan={7}>
                  Cargando empresas…
                </TD>
              </TR>
            ) : companies.length === 0 ? (
              <TR>
                <TD tone="muted" colSpan={7}>
                  Aún no hay empresas registradas.
                </TD>
              </TR>
            ) : (
              companies.map((c) => (
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
                      tone={
                        c.status === "Activa"
                          ? "success"
                          : c.status === "Trial"
                            ? "warning"
                            : "danger"
                      }
                      dot
                    >
                      {c.status}
                    </Badge>
                  </TD>
                  <TD right nowrap>
                    <button
                      type="button"
                      disabled={pendingId === c.id}
                      onClick={() => setConfirming(c)}
                      className="text-ink-900 hover:underline font-medium text-nav cursor-pointer disabled:opacity-40 disabled:cursor-wait"
                    >
                      {pendingId === c.id
                        ? "Guardando…"
                        : c.status === "Suspendida"
                          ? "Reactivar"
                          : "Suspender"}
                    </button>
                  </TD>
                </TR>
              ))
            )}
          </tbody>
        </TableCard>
      </main>

      <ConfirmDialog
        open={confirming !== null}
        title={confirming?.status === "Suspendida" ? "Reactivar empresa" : "Suspender empresa"}
        message={
          confirming
            ? confirming.status === "Suspendida"
              ? `Se restaurará el acceso de ${confirming.name}.`
              : `Se bloqueará el acceso de ${confirming.name} hasta su reactivación.`
            : ""
        }
        confirmLabel={confirming?.status === "Suspendida" ? "Reactivar" : "Suspender"}
        danger={confirming?.status !== "Suspendida"}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          const company = confirming;
          setConfirming(null);
          if (company) void toggle(company);
        }}
      />
    </div>
  );
}
