"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ApiError } from "@/lib/api";
import { branchStorageKey, tenantKeyOf } from "@/lib/session-state";
import { fetchBranches, fetchTenant, type Tenant } from "@/lib/tenant-api";
import {
  ALL_BRANCHES,
  BRANCH_IDS,
  DEMO_COMPANY,
  GENERAL_BRANCH,
  initialBranches,
  type Branch,
} from "@/lib/tenancy";
import { branchIdsOf, resolveActiveBranch } from "@/lib/tenant-scope";
import { useSession } from '@/components/dashboard/providers/session';

export type TenantContextValue = {
  /** Empresa del token; `null` sin sesión o si la API falló. */
  tenant: Tenant | null;
  company: { legalName: string; ruc: string };
  /** Sucursales visibles: incluye la vista agregada `todas` con sesión. */
  branches: Branch[];
  /** Sucursales reales (sin `todas`). */
  realBranches: Branch[];
  branchIds: string[];
  activeBranch: Branch;
  activeBranchId: string;
  isGeneral: boolean;
  /** Sucursal donde se escribe la operación (la primera real en `todas`). */
  writeBranchId: string;
  loading: boolean;
  error: string | null;
  setActiveBranch: (id: string) => void;
  /** Vuelve a pedir empresa y sucursales sin tocar la sucursal activa. */
  refreshTenant: () => void;
};

const Ctx = createContext<TenantContextValue | null>(null);

/** Empresa/sucursales atadas a su `empresaId` para no heredar el tenant anterior. */
type TenantSnapshot = {
  empresaId: string;
  tenant: Tenant | null;
  branches: Branch[];
};

type TenantFailure = {
  empresaId: string;
  message: string;
};

function readSavedBranch(storageKey: string): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

/**
 * Empresa y sucursales del shell (Fase 4 etapa 2). Sin sesión usa la demo;
 * con sesión **nunca** cae a demo: si la API falla queda `tenant: null` y
 * solo la vista general. No confundir con el estado de negocio, que sigue en
 * `ModulesProvider`.
 */
export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { ready, hasSession, currentUser } = useSession();
  const empresaId = currentUser?.empresaId ?? null;
  const userBranchId = currentUser?.branchId ?? null;
  const tenantKey = tenantKeyOf(currentUser);

  const [snapshot, setSnapshot] = useState<TenantSnapshot | null>(null);
  const [activeBranchId, setActiveBranchId] = useState<string>(GENERAL_BRANCH.id);
  const [failure, setFailure] = useState<TenantFailure | null>(null);
  /** Descarta respuestas de una empresa/recarga anterior. */
  const requestId = useRef(0);

  /* Último usuario para la resolución de sucursal dentro de la carga. */
  const userRef = useRef<{ empresaId: string | null; branchId: string | null }>({
    empresaId,
    branchId: userBranchId,
  });
  useEffect(() => {
    userRef.current = { empresaId, branchId: userBranchId };
  }, [empresaId, userBranchId]);

  const loadTenant = useCallback(async (empresa: string, signal?: AbortSignal) => {
    const id = ++requestId.current;
    try {
      const [tenantData, branchData] = await Promise.all([
        fetchTenant(signal),
        fetchBranches(signal),
      ]);
      if (signal?.aborted || id !== requestId.current) return;
      setSnapshot({ empresaId: empresa, tenant: tenantData, branches: branchData });
      setFailure(null);
      setActiveBranchId(
        resolveActiveBranch({
          userBranchId: userRef.current.empresaId === empresa ? userRef.current.branchId : null,
          saved: readSavedBranch(branchStorageKey(empresa)),
          realIds: branchIdsOf(branchData),
        }),
      );
    } catch (error) {
      if (signal?.aborted || id !== requestId.current) return;
      // Sin datos reales no se cae a la demo: el shell queda sin sucursal
      // operativa hasta que la API responda.
      setSnapshot({ empresaId: empresa, tenant: null, branches: [] });
      setFailure({
        empresaId: empresa,
        message:
          error instanceof ApiError ? error.message : "No se pudo cargar la empresa.",
      });
    }
  }, []);

  /* Una sola carga por `empresaId` (y al montar la sesión). */
  useEffect(() => {
    if (!ready || !empresaId) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga del tenant al hidratar la sesión
    void loadTenant(empresaId, controller.signal);
    return () => controller.abort();
  }, [ready, empresaId, loadTenant]);

  /* Sin sesión: sucursal recordada del navegador dentro de la demo. */
  useEffect(() => {
    if (!ready || hasSession) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura la sucursal demo
    setActiveBranchId(
      resolveActiveBranch({ saved: readSavedBranch(tenantKey), realIds: BRANCH_IDS }),
    );
  }, [ready, hasSession, tenantKey]);

  const loaded = Boolean(empresaId) && snapshot?.empresaId === empresaId;

  /** Anti-flash: la demo (y su empresa) solo aparece con la sesión hidratada. */
  const realBranches = useMemo<Branch[]>(() => {
    if (!ready) return [];
    if (!hasSession) return initialBranches;
    return loaded && snapshot ? snapshot.branches : [];
  }, [ready, hasSession, loaded, snapshot]);

  const branches = useMemo<Branch[]>(() => {
    if (!ready) return [];
    if (!hasSession) return ALL_BRANCHES;
    return loaded ? [GENERAL_BRANCH, ...realBranches] : [];
  }, [ready, hasSession, loaded, realBranches]);

  const branchIds = useMemo<string[]>(() => {
    if (!ready) return [];
    if (!hasSession) return BRANCH_IDS;
    return loaded ? branchIdsOf(realBranches) : [];
  }, [ready, hasSession, loaded, realBranches]);

  /* Mientras la sesión está en vuelo no se opera con la sucursal demo; el rol
     atado a sucursal conserva la suya para no escribir en la vista agregada. */
  const resolvedActiveId = !ready
    ? GENERAL_BRANCH.id
    : hasSession && !loaded
      ? (userBranchId ?? GENERAL_BRANCH.id)
      : activeBranchId;

  const activeBranch =
    branches.find((branch) => branch.id === resolvedActiveId) ?? branches[0] ?? GENERAL_BRANCH;
  const isGeneral = resolvedActiveId === GENERAL_BRANCH.id;
  const writeBranchId = isGeneral ? branchIds[0] : resolvedActiveId;

  const company = useMemo(() => {
    if (!ready) return { legalName: "—", ruc: "—" };
    if (!hasSession) return DEMO_COMPANY;
    return snapshot?.empresaId === empresaId && snapshot.tenant
      ? { legalName: snapshot.tenant.legalName, ruc: snapshot.tenant.ruc }
      : { legalName: "—", ruc: "—" };
  }, [ready, hasSession, snapshot, empresaId]);

  const setActiveBranch = useCallback(
    (id: string) => {
      if (id !== GENERAL_BRANCH.id && !branchIds.includes(id)) return;
      setActiveBranchId(id);
      try {
        localStorage.setItem(branchStorageKey(tenantKey), id);
      } catch {
        /* almacenamiento no disponible */
      }
    },
    [branchIds, tenantKey],
  );

  const refreshTenant = useCallback(() => {
    if (!empresaId) return;
    void loadTenant(empresaId);
  }, [empresaId, loadTenant]);

  const error = failure && failure.empresaId === empresaId ? failure.message : null;
  const loading = !ready || (hasSession && !loaded);

  const value = useMemo(
    () => ({
      tenant: loaded && snapshot ? snapshot.tenant : null,
      company,
      branches,
      realBranches,
      branchIds,
      activeBranch,
      activeBranchId: resolvedActiveId,
      isGeneral,
      writeBranchId,
      loading,
      error,
      setActiveBranch,
      refreshTenant,
    }),
    [
      loaded,
      snapshot,
      company,
      branches,
      realBranches,
      branchIds,
      activeBranch,
      resolvedActiveId,
      isGeneral,
      writeBranchId,
      loading,
      error,
      setActiveBranch,
      refreshTenant,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTenant() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTenant debe usarse dentro de TenantProvider");
  return ctx;
}
