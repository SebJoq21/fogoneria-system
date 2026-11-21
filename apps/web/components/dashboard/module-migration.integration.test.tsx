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
import { CashProvider } from '@/features/cash/provider';
import { ExpensesProvider } from '@/features/expenses/provider';
import { InventoryProvider } from '@/features/inventory/provider';
import { AccountsProvider } from '@/features/orders/provider';
import { PromotionsProvider } from '@/features/promotions/provider';
import { ReceiptsProvider } from '@/features/receipts/provider';
import { ReservationsProvider } from '@/features/reservations/provider';
import { StaffProvider } from '@/features/staff/provider';
import { TablesProvider } from '@/features/tables/provider';
import { TicketsProvider } from './providers/tickets';
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
        coupons: [{ code: 'LEGACY10', discount: '10% OFF', used: 1, limit: 10, expires: '30 Nov 2026' }],
        receipts: [
          {
            id: 'B001-50',
            type: '03',
            at: '2026-11-20T12:00:00.000Z',
            date: 'Hoy',
            customer: 'Ana',
            docType: '',
            docNumber: '',
            subtotal: 50,
            igv: 9,
            total: 59,
            status: 'Pagada',
            source: 'Mesa 1',
            estadoSunat: 'aceptado',
            intentosEnvio: 1,
          },
        ],
        combos: [
          { id: 50, name: 'Combo legacy', description: 'Demo', productIds: [], price: 10, status: 'Activo' },
        ],
        tickets: [],
        scopes: {
          miraflores: {
            orders: [],
            tables: [],
            cash: [
              {
                id: 50,
                at: '2026-11-20T12:00:00.000Z',
                datetime: 'Hoy 12:00',
                concept: 'Venta legacy',
                kind: 'Ingreso',
                amount: 59,
                method: 'Efectivo',
              },
            ],
          },
        },
        accounts: [legacyAccount],
        cashShifts: [
          {
            id: 'CH-legacy',
            branchId: 'miraflores',
            status: 'abierto',
            openedBy: 'Rosa',
            openedAt: '2026-11-20T09:00:00.000Z',
            openingFund: 200,
            closedBy: null,
            closedAt: null,
            countedCash: null,
            expectedCash: null,
            difference: null,
            observations: '',
          },
        ],
        sunatContingencia: true,
      }),
    );

    const shell = (
      <CrmProvider>
        <ExpensesProvider>
          <InventoryProvider>
            <TablesProvider>
              <ReservationsProvider>
                <AccountsProvider>
                  <CashProvider>
                    <ReceiptsProvider>
                      <PromotionsProvider>
                        <StaffProvider>
                          <TicketsProvider>
                            <ModulesProvider initialPayments={[]}>
                              <div />
                            </ModulesProvider>
                          </TicketsProvider>
                        </StaffProvider>
                      </PromotionsProvider>
                    </ReceiptsProvider>
                  </CashProvider>
                </AccountsProvider>
              </ReservationsProvider>
            </TablesProvider>
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
    expect(JSON.parse(localStorage.getItem('fogoneria:cash:v1:anon') ?? '{}')).toMatchObject({
      shifts: [{ id: 'CH-legacy' }],
      movementsByBranch: { miraflores: [{ id: 50 }] },
    });
    expect(JSON.parse(localStorage.getItem('fogoneria:receipts:v1:anon') ?? '{}')).toMatchObject({
      receipts: [{ id: 'B001-50' }],
      sunatContingencia: true,
    });
    expect(JSON.parse(localStorage.getItem('fogoneria:promotions:v1:anon') ?? '{}')).toMatchObject({
      combos: [{ id: 50 }],
      coupons: [{ code: 'LEGACY10' }],
    });
    expect(JSON.parse(localStorage.getItem('fogoneria:orders-demo:v1:anon') ?? '{}')).toMatchObject({
      miraflores: [],
    });
    expect(JSON.parse(localStorage.getItem('fogoneria:tables-demo:v1:anon') ?? '{}')).toMatchObject({
      miraflores: [],
    });
    expect(JSON.parse(localStorage.getItem('fogoneria:reservations:v1:anon') ?? 'null')).toEqual([]);
    expect(JSON.parse(localStorage.getItem('fogoneria:tickets:v1:anon') ?? 'null')).toEqual([]);
    // F6c3: el ErpState legacy se migra completo y se borra.
    expect(localStorage.getItem('fogoneria:erp:v2:anon')).toBeNull();

    unmount();
    render(shell);
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('fogoneria:crm:v1:anon') ?? '[]')).toHaveLength(1),
    );
    expect(JSON.parse(localStorage.getItem('fogoneria:expenses:v1:anon') ?? '[]')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('fogoneria:staff:v1:anon') ?? '[]')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('fogoneria:orders:v1:anon') ?? '[]')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('fogoneria:cash:v1:anon') ?? '{}').shifts).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('fogoneria:receipts:v1:anon') ?? '{}').receipts).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('fogoneria:promotions:v1:anon') ?? '{}').combos).toHaveLength(1);
    expect(
      JSON.parse(localStorage.getItem('fogoneria:orders-demo:v1:anon') ?? '{}').miraflores,
    ).toHaveLength(0);
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
          <TablesProvider>
            <ReservationsProvider>
              <AccountsProvider>
                <CashProvider>
                  <ReceiptsProvider>
                    <PromotionsProvider>
                      <StaffProvider>
                        <TicketsProvider>
                          <ModulesProvider initialPayments={[]}>
                            <div />
                          </ModulesProvider>
                        </TicketsProvider>
                      </StaffProvider>
                    </PromotionsProvider>
                  </ReceiptsProvider>
                </CashProvider>
              </AccountsProvider>
            </ReservationsProvider>
          </TablesProvider>
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
      scopes: {
        miraflores: {
          orders: [],
          tables: [],
          cash: [
            {
              id: 70,
              at: '2026-11-20T12:00:00.000Z',
              datetime: 'Hoy 12:00',
              concept: 'Venta remap',
              kind: 'Ingreso',
              amount: 20,
              method: 'Efectivo',
            },
          ],
        },
      },
      cashShifts: [
        {
          id: 'CH-remap',
          branchId: 'miraflores',
          status: 'abierto',
          openedBy: 'Rosa',
          openedAt: '2026-11-20T09:00:00.000Z',
          openingFund: 100,
          closedBy: null,
          closedAt: null,
          countedCash: null,
          expectedCash: null,
          difference: null,
          observations: '',
        },
      ],
      sunatContingencia: false,
      accounts: [{ ...legacyAccount, id: 'CT-remap', branchId: SLUG }],
    }),
  );
}

function cajaGuardada() {
  return JSON.parse(localStorage.getItem(`fogoneria:cash:v1:${EMPRESA}`) ?? '{}') as {
    shifts?: Array<{ id: string; branchId: string }>;
    movementsByBranch?: Record<string, Array<{ id: number }>>;
  };
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

    await waitFor(() => expect(cajaGuardada().shifts?.[0]?.branchId).toBe(UUID));
    expect(cajaGuardada().movementsByBranch?.[UUID]).toHaveLength(1);
    expect(cajaGuardada().movementsByBranch?.[SLUG]).toBeUndefined();
  });

  it('remapea cuando las sucursales llegan después y no remapea dos veces', async () => {
    activarSesion();
    sembrarCuentaLegacy();

    const { rerender } = render(shell());
    await waitFor(() => expect(cuentasGuardadas()[0]?.branchId).toBe(SLUG));
    await waitFor(() => expect(cajaGuardada().shifts?.[0]?.branchId).toBe(SLUG));

    activarSucursalReal();
    rerender(shell());
    await waitFor(() => expect(cuentasGuardadas()[0]?.branchId).toBe(UUID));
    await waitFor(() => expect(cajaGuardada().shifts?.[0]?.branchId).toBe(UUID));

    // Nueva referencia con el mismo contenido: el efecto vuelve a correr y
    // debe ser idempotente (ni duplica ni pierde la cuenta ni la caja).
    tenant.realBranches = [{ ...rama }];
    rerender(shell());
    await waitFor(() => {
      const guardadas = cuentasGuardadas();
      expect(guardadas).toHaveLength(1);
      expect(guardadas[0]).toMatchObject({ id: 'CT-remap', branchId: UUID, tableId: 2 });
      expect(cajaGuardada().shifts).toHaveLength(1);
      expect(cajaGuardada().movementsByBranch?.[UUID]).toHaveLength(1);
    });
  });
});
