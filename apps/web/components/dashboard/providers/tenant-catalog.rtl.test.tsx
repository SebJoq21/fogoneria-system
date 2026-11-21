// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sesion = vi.hoisted(() => ({
  ready: true,
  hasSession: true,
  currentUser: { id: 'u-1', empresaId: 'e-1', branchId: 's-1' } as null | { id: string; empresaId: string | null; branchId: string | null },
}));

const api = vi.hoisted(() => ({
  fetchTenant: vi.fn(),
  fetchBranches: vi.fn(),
  fetchCatalog: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deactivateCategory: vi.fn(),
  createDish: vi.fn(),
  updateDish: vi.fn(),
  setDishActive: vi.fn(),
  deleteDish: vi.fn(),
  createModifierGroup: vi.fn(),
  updateModifierGroup: vi.fn(),
  deactivateModifierGroup: vi.fn(),
  createPriceList: vi.fn(),
  activatePriceList: vi.fn(),
  deletePriceList: vi.fn(),
  setPrices: vi.fn(),
}));

vi.mock('./session', () => ({ useSession: () => sesion }));
vi.mock('@/lib/tenant-api', () => ({ fetchTenant: api.fetchTenant, fetchBranches: api.fetchBranches }));
vi.mock('@/lib/catalog-api', () => api);

import { TenantProvider, useTenant } from './tenant';
import { CatalogoProvider, useCatalogoState } from './catalog';

let tenantCtx: ReturnType<typeof useTenant>;
function TenantSonda() {
  const value = useTenant();
  useEffect(() => {
    tenantCtx = value;
  }, [value]);
  return null;
}

let catalogCtx: ReturnType<typeof useCatalogoState>;
function CatalogSonda() {
  const value = useCatalogoState();
  useEffect(() => {
    catalogCtx = value;
  }, [value]);
  return null;
}

const tenantApi = {
  id: 'e-1',
  legalName: 'Mi Restaurante',
  tradeName: 'MR',
  ruc: '20123456786',
  status: 'ACTIVE',
  plan: 'PROFESIONAL',
  branchLimit: 3,
  trialEnd: null,
  mrr: 149.9,
  totalBranches: 2,
  totalUsers: 5,
};

const branch = (id: string, name: string, isMain = false) => ({
  id,
  name,
  short: name,
  address: '',
  phone: '',
  isMain,
  status: 'Abierta' as const,
});

const catalogo = {
  categories: [{ id: 'c-1', name: 'Fondos', position: 1 }],
  products: [
    {
      id: 'p-1',
      sku: 'LOM',
      name: 'Lomo',
      description: '',
      categoryId: 'c-1',
      image: '',
      modifierGroupIds: [],
      status: 'Activo' as const,
    },
  ],
  modifierGroups: [],
  priceLists: [{ id: 'l-1', name: 'Carta', active: true, validFrom: '', validTo: '', prices: {} }],
};

beforeEach(() => {
  localStorage.clear();
  sesion.currentUser = { id: 'u-1', empresaId: 'e-1', branchId: 's-1' };
  sesion.hasSession = true;
  api.fetchTenant.mockResolvedValue(tenantApi);
  api.fetchBranches.mockResolvedValue([branch('s-1', 'Miraflores', true), branch('s-2', 'Surco')]);
  api.fetchCatalog.mockResolvedValue(catalogo);
  for (const fn of Object.values(api)) {
    if (fn !== api.fetchTenant && fn !== api.fetchBranches && fn !== api.fetchCatalog) {
      fn.mockReset().mockResolvedValue(undefined);
    }
  }
});

afterEach(cleanup);

describe('TenantProvider', () => {
  it('carga empresa y sucursales, y persiste el cambio de sucursal', async () => {
    render(
      <TenantProvider>
        <TenantSonda />
      </TenantProvider>,
    );
    await waitFor(() => expect(tenantCtx.branches.length).toBeGreaterThan(1));
    expect(tenantCtx.company).toMatchObject({ legalName: 'Mi Restaurante' });
    expect(tenantCtx.activeBranchId).toBe('s-1');
    expect(tenantCtx.isGeneral).toBe(false);

    act(() => {
      tenantCtx.setActiveBranch('s-2');
    });
    expect(tenantCtx.activeBranchId).toBe('s-2');
    expect(localStorage.getItem('fogoneria:branch:e-1')).toBe('s-2');

    await act(async () => {
      tenantCtx.refreshTenant();
    });
    expect(api.fetchTenant).toHaveBeenCalledTimes(2);
  });

  it('expone el error de la API y no cae a la demo', async () => {
    api.fetchTenant.mockRejectedValue(new Error('tenant caído'));
    render(
      <TenantProvider>
        <TenantSonda />
      </TenantProvider>,
    );
    await waitFor(() => expect(tenantCtx.error).toBe('No se pudo cargar la empresa.'));
    expect(tenantCtx.tenant).toBeNull();
    expect(tenantCtx.isGeneral).toBe(true);
  });

  it('sin sesión usa la empresa demo', async () => {
    sesion.hasSession = false;
    sesion.currentUser = null;
    render(
      <TenantProvider>
        <TenantSonda />
      </TenantProvider>,
    );
    await waitFor(() => expect(tenantCtx.loading).toBe(false));
    expect(tenantCtx.tenant).toBeNull();
    expect(tenantCtx.branches.length).toBeGreaterThan(0);
  });
});

describe('CatalogoProvider', () => {
  it('carga el snapshot y delega las acciones en la API', async () => {
    render(
      <CatalogoProvider>
        <CatalogSonda />
      </CatalogoProvider>,
    );
    await waitFor(() => expect(catalogCtx.products.length).toBeGreaterThan(0));
    expect(catalogCtx.priceOf('p-1')).toBe(0);

    await act(async () => {
      await catalogCtx.saveProduct({
        name: 'Lomo',
        description: '',
        categoryId: 'c-1',
        image: '',
        status: 'Activo',
        modifierGroupIds: [],
        price: 24.9,
      });
      await catalogCtx.setProductActive('p-1', false);
      await catalogCtx.saveCategory({ name: 'Bebidas', position: 2 });
      await catalogCtx.deleteCategory('c-1');
      await catalogCtx.createModifierGroup({ name: 'Término', required: true, multi: false });
      await catalogCtx.updateModifierGroup('g-1', { name: 'Término' });
      await catalogCtx.deleteModifierGroup('g-1');
      await catalogCtx.createPriceList('Delivery', 'l-1');
      await catalogCtx.activatePriceList('l-1');
      await catalogCtx.setPrice('l-1', 'p-1', 30);
    });

    expect(api.createDish).toHaveBeenCalled();
    expect(api.setDishActive).toHaveBeenCalled();
    expect(api.createCategory).toHaveBeenCalled();
    expect(api.deactivateCategory).toHaveBeenCalled();
    expect(api.createModifierGroup).toHaveBeenCalled();
    expect(api.updateModifierGroup).toHaveBeenCalled();
    expect(api.deactivateModifierGroup).toHaveBeenCalled();
    expect(api.createPriceList).toHaveBeenCalled();
    expect(api.activatePriceList).toHaveBeenCalled();
    expect(api.setPrices).toHaveBeenCalled();
    expect(catalogCtx.catalogVersion).toBeGreaterThan(0);
  });

  it('expone el error de carga y permite reintentar', async () => {
    api.fetchCatalog.mockRejectedValueOnce(new Error('catálogo caído'));
    render(
      <CatalogoProvider>
        <CatalogSonda />
      </CatalogoProvider>,
    );
    await waitFor(() => expect(catalogCtx.catalogError).toBe('No se pudo cargar el catálogo.'));
    expect(catalogCtx.catalogLoading).toBe(false);

    api.fetchCatalog.mockResolvedValue(catalogo);
    await act(async () => {
      await catalogCtx.refreshCatalog();
    });
    await waitFor(() => expect(catalogCtx.products.length).toBeGreaterThan(0));
    expect(catalogCtx.catalogError).toBeNull();
  });
});
