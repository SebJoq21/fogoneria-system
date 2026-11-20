import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const sesion = vi.hoisted(() => ({
  ready: true,
  hasSession: false,
  currentUser: null as null | { empresaId: string | null; branchId: string | null },
}));

vi.mock('./session', () => ({ useSession: () => sesion }));

import { TenantProvider, useTenant } from './tenant';

function Sonda() {
  const {
    tenant,
    company,
    branches,
    realBranches,
    activeBranch,
    activeBranchId,
    isGeneral,
    loading,
    error,
    setActiveBranch,
    refreshTenant,
  } = useTenant();
  return (
    <span>
      {String(tenant)}|{company.legalName}|{branches.length}|{realBranches.length}|
      {activeBranch.id}|{activeBranchId}|{String(isGeneral)}|{String(loading)}|{String(error)}|
      {typeof setActiveBranch}|{typeof refreshTenant}
    </span>
  );
}

describe('TenantProvider', () => {
  it('sin sesión usa la empresa y sucursales demo', () => {
    sesion.hasSession = false;
    sesion.currentUser = null;
    const markup = renderToStaticMarkup(
      <TenantProvider>
        <Sonda />
      </TenantProvider>,
    );
    expect(markup).toContain('null|');
    expect(markup).toContain('|4|3|');
    expect(markup).toContain('function|function');
  });

  it('con sesión y tenant aún sin cargar no cae a la demo', () => {
    sesion.hasSession = true;
    sesion.currentUser = { empresaId: 'e-1', branchId: 's-1' };
    const markup = renderToStaticMarkup(
      <TenantProvider>
        <Sonda />
      </TenantProvider>,
    );
    expect(markup).toContain('null|');
    expect(markup).toContain('|true|');
  });
});
