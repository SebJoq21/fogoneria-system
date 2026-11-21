// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sesion = vi.hoisted(() => ({
  currentUser: null as null | { empresaId: string },
  hasSession: false,
  ready: true,
  login: vi.fn(),
  logout: vi.fn(),
}));

const avisos = vi.hoisted(() => ({
  notifications: [],
  hasUnread: false,
  notify: vi.fn(),
  clearUnread: vi.fn(),
}));

type RamaMock = { id: string; name: string; short: string; isMain: boolean; status: string };

const tenant = vi.hoisted(() => ({
  tenant: null,
  company: { legalName: 'Demo', ruc: '20123456786' },
  branches: [] as RamaMock[],
  realBranches: [] as RamaMock[],
  branchIds: [] as string[],
  activeBranch: { id: 'todas', name: 'Todas', short: 'Todas', isMain: false, status: 'Abierta' },
  activeBranchId: 'todas',
  isGeneral: true,
  writeBranchId: 'todas',
  setActiveBranch: vi.fn(),
  loading: false,
  error: null,
  refreshTenant: vi.fn(),
}));

const catalogo = vi.hoisted(() => ({
  products: [],
  categories: [],
  modifierGroups: [],
  priceLists: [],
  catalogLoading: false,
  catalogError: null,
  catalogVersion: 0,
  refreshCatalog: vi.fn().mockResolvedValue(undefined),
  saveProduct: vi.fn(),
  setProductActive: vi.fn(),
  saveCategory: vi.fn(),
  deleteCategory: vi.fn(),
  createModifierGroup: vi.fn(),
  updateModifierGroup: vi.fn(),
  deleteModifierGroup: vi.fn(),
  createPriceList: vi.fn(),
  activatePriceList: vi.fn(),
  setPrice: vi.fn(),
  priceOf: vi.fn(() => 0),
  categoryNameOf: vi.fn(() => '—'),
}));

vi.mock('@/components/dashboard/providers/session', () => ({ useSession: () => sesion }));
vi.mock('@/components/dashboard/providers/notifications', () => ({
  useNotifications: () => avisos,
}));
vi.mock('@/features/tenant/provider', () => ({ useTenant: () => tenant }));
vi.mock('@/components/dashboard/providers/catalog', () => ({
  useCatalogoState: () => catalogo,
}));
vi.mock('@/lib/realtime', () => ({ connectOrdersRealtime: () => () => {} }));
vi.mock('@/lib/orders-api', () => ({
  createOrder: vi.fn(),
  updateOrderStatus: vi.fn(),
  getOrder: vi.fn(),
  listOrders: vi.fn().mockResolvedValue({ items: [] }),
}));
vi.mock('@/lib/tables-api', () => ({ listTables: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/reservations-api', () => ({
  listReservations: vi.fn().mockResolvedValue({ items: [] }),
}));

import { CrmProvider } from '@/features/crm/provider';
import { ExpensesProvider } from '@/features/expenses/provider';
import { InventoryProvider } from '@/features/inventory/provider';
import { AccountsProvider } from '@/features/orders/provider';
import { StaffProvider } from '@/features/staff/provider';
import { ModulesProvider } from './ModulesProvider';

const legacyCustomer = {
  id: 99,
  name: 'Cliente legacy',
  phone: '999999999',
  points: 7,
  visits: 2,
  segment: 'Nuevo',
  lastVisit: 'Ayer',
};

const legacyAccount = {
  id: 'CT-99',
  branchId: 'miraflores',
  tableId: 2,
  tableApiId: null,
  label: 'Mesa 2',
  customer: 'Ana',
  waiter: 'Luis',
  openedAt: '2026-11-20T12:00:00.000Z',
  closedAt: null,
  status: 'abierta',
  items: [],
  payments: [],
  tip: 0,
  discount: 0,
  discountConcept: '',
  couponCode: null,
  customerId: null,
  motivoAnulacion: null,
};

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('migración de slices en el arranque del shell', () => {
  it('migra antes del primer save, purga el legacy y no duplica al remontar', async () => {
    localStorage.setItem(
      'fogoneria:erp:v2:anon',
      JSON.stringify({
        version: 2,
        reservations: [],
        customers: [legacyCustomer],
        expenses: [{ id: 8, date: 'Hoy', category: 'Insumos', supplier: 'Proveedor', amount: '$10.00', status: 'Pagado' }],
        ingredients: [{ id: 8, name: 'Sal', category: 'Insumos', stock: 1, min: 1, unit: 'kg', state: 'Óptimo' }],
        movements: [{ id: 8, datetime: 'Hoy', type: 'Entrada', ingredient: 'Sal', qty: '+1 kg', reason: 'Compra' }],
        roles: [{ id: 8, name: 'Rol legacy', description: 'Demo' }],
        coupons: [],
        receipts: [],
        combos: [],
        tickets: [],
        scopes: {},
        accounts: [legacyAccount],
        cashShifts: [],
        sunatContingencia: false,
      }),
    );

    const shell = (
      <CrmProvider>
        <ExpensesProvider>
          <InventoryProvider>
            <AccountsProvider>
              <StaffProvider>
                <ModulesProvider initialPayments={[]}>
                  <div />
                </ModulesProvider>
              </StaffProvider>
            </AccountsProvider>
          </InventoryProvider>
        </ExpensesProvider>
      </CrmProvider>
    );
    const { unmount } = render(shell);

    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('fogoneria:crm:v1:anon') ?? '[]')).toHaveLength(1),
    );
    expect(JSON.parse(localStorage.getItem('fogoneria:expenses:v1:anon') ?? '[]')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('fogoneria:inventory:v1:anon') ?? '{}')).toMatchObject({
      ingredients: [{ id: 8 }],
      movements: [{ id: 8 }],
    });
    expect(JSON.parse(localStorage.getItem('fogoneria:staff:v1:anon') ?? '[]')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('fogoneria:orders:v1:anon') ?? '[]')).toHaveLength(1);
    const legacy = JSON.parse(localStorage.getItem('fogoneria:erp:v2:anon') ?? '{}');
    expect(legacy.customers).toBeUndefined();
    expect(legacy.expenses).toBeUndefined();
    expect(legacy.ingredients).toBeUndefined();
    expect(legacy.movements).toBeUndefined();
    expect(legacy.roles).toBeUndefined();
    expect(legacy.accounts).toBeUndefined();

    unmount();
    render(shell);
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('fogoneria:crm:v1:anon') ?? '[]')).toHaveLength(1),
    );
    expect(JSON.parse(localStorage.getItem('fogoneria:expenses:v1:anon') ?? '[]')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('fogoneria:staff:v1:anon') ?? '[]')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('fogoneria:orders:v1:anon') ?? '[]')).toHaveLength(1);
  });
});

const SLUG = 'miraflores';
const UUID = '22222222-2222-4222-8222-222222222222';
const EMPRESA = 'emp-remap';
const rama: RamaMock = {
  id: UUID,
  name: 'Miraflores',
  short: 'Miraflores',
  isMain: true,
  status: 'Abierta',
};

function shell() {
  return (
    <CrmProvider>
      <ExpensesProvider>
        <InventoryProvider>
          <AccountsProvider>
            <StaffProvider>
              <ModulesProvider initialPayments={[]}>
                <div />
              </ModulesProvider>
            </StaffProvider>
          </AccountsProvider>
        </InventoryProvider>
      </ExpensesProvider>
    </CrmProvider>
  );
}

function activarSesion() {
  sesion.currentUser = { empresaId: EMPRESA };
  sesion.hasSession = true;
}

function activarSucursalReal() {
  tenant.realBranches = [rama];
  tenant.branches = [rama];
  tenant.branchIds = [UUID];
  tenant.activeBranch = rama;
  tenant.activeBranchId = UUID;
  tenant.writeBranchId = UUID;
  tenant.isGeneral = false;
}

function sembrarCuentaLegacy() {
  localStorage.setItem(
    `fogoneria:erp:v2:${EMPRESA}`,
    JSON.stringify({
      version: 2,
      reservations: [],
      coupons: [],
      receipts: [],
      combos: [],
      tickets: [],
      scopes: {},
      cashShifts: [],
      sunatContingencia: false,
      accounts: [{ ...legacyAccount, id: 'CT-remap', branchId: SLUG }],
    }),
  );
}

function cuentasGuardadas() {
  return JSON.parse(localStorage.getItem(`fogoneria:orders:v1:${EMPRESA}`) ?? '[]') as Array<{
    id: string;
    branchId: string;
    tableId: number | null;
  }>;
}

describe('remapeo slug→UUID de cuentas (F6c1)', () => {
  beforeEach(() => {
    sesion.currentUser = null;
    sesion.hasSession = false;
    tenant.realBranches = [];
    tenant.branches = [];
    tenant.branchIds = [];
    tenant.activeBranch = { id: 'todas', name: 'Todas', short: 'Todas', isMain: false, status: 'Abierta' };
    tenant.activeBranchId = 'todas';
    tenant.writeBranchId = 'todas';
    tenant.isGeneral = true;
  });

  it('remapea las cuentas hidratadas si las sucursales ya están al montar', async () => {
    activarSesion();
    activarSucursalReal();
    sembrarCuentaLegacy();

    render(shell());

    await waitFor(() => expect(cuentasGuardadas()[0]?.branchId).toBe(UUID));
    const guardadas = cuentasGuardadas();
    expect(guardadas).toHaveLength(1);
    expect(guardadas[0]).toMatchObject({ id: 'CT-remap', branchId: UUID, tableId: 2 });
  });

  it('remapea cuando las sucursales llegan después y no remapea dos veces', async () => {
    activarSesion();
    sembrarCuentaLegacy();

    const { rerender } = render(shell());
    await waitFor(() => expect(cuentasGuardadas()[0]?.branchId).toBe(SLUG));

    activarSucursalReal();
    rerender(shell());
    await waitFor(() => expect(cuentasGuardadas()[0]?.branchId).toBe(UUID));

    // Nueva referencia con el mismo contenido: el efecto vuelve a correr y
    // debe ser idempotente (ni duplica ni pierde la cuenta).
    tenant.realBranches = [{ ...rama }];
    rerender(shell());
    await waitFor(() => {
      const guardadas = cuentasGuardadas();
      expect(guardadas).toHaveLength(1);
      expect(guardadas[0]).toMatchObject({ id: 'CT-remap', branchId: UUID, tableId: 2 });
    });
  });
});
