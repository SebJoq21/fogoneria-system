// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sesion = vi.hoisted(() => ({
  currentUser: null as null | { id: string; name: string; role: string; empresaId: string | null; branchId: string | null; initials: string; email: string },
  hasSession: false,
  ready: true,
  login: vi.fn(),
  logout: vi.fn(),
}));

const avisos = vi.hoisted(() => ({
  notifications: [] as unknown[],
  hasUnread: false,
  notify: vi.fn(),
  clearUnread: vi.fn(),
}));

const tenant = vi.hoisted(() => ({
  tenant: null,
  company: { legalName: 'Demo', ruc: '20123456786' },
  branches: [{ id: 'miraflores', name: 'Miraflores', short: 'Miraflores', isMain: true, status: 'Abierta' }],
  realBranches: [] as unknown[],
  branchIds: ['miraflores'],
  activeBranch: { id: 'miraflores', name: 'Miraflores', short: 'Miraflores', isMain: true, status: 'Abierta' },
  activeBranchId: 'miraflores',
  isGeneral: false,
  writeBranchId: 'miraflores',
  setActiveBranch: vi.fn(),
  loading: false,
  error: null,
  refreshTenant: vi.fn(),
}));

const catalogo = vi.hoisted(() => ({
  products: [{ id: 'p-1', sku: 'LOM', name: 'Lomo', description: '', categoryId: 'c-1', image: '', modifierGroupIds: [], status: 'Activo' }],
  categories: [{ id: 'c-1', name: 'Fondos', position: 1 }],
  modifierGroups: [],
  priceLists: [{ id: 'l-1', name: 'Carta', active: true, validFrom: '', validTo: '', prices: { 'p-1': 24.9 } }],
  catalogLoading: false,
  catalogError: null,
  catalogVersion: 1,
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
  priceOf: vi.fn(() => 24.9),
  categoryNameOf: vi.fn(() => 'Fondos'),
}));

const crm = vi.hoisted(() => {
  const customers: { id: number; name: string; phone: string; points: number; visits: number; segment: string; lastVisit: string }[] = [];
  return {
    customers,
    setCustomers: vi.fn((next: typeof customers) => {
      customers.splice(0, customers.length, ...next);
    }),
    addPoints: vi.fn((id: number, points: number) => {
      const customer = customers.find((item) => item.id === id);
      if (customer) {
        customer.points += points;
        customer.visits += 1;
        customer.lastVisit = 'Hoy';
      }
    }),
    resetCustomers: vi.fn(() => {
      customers.splice(0, customers.length);
    }),
  };
});

const expenses = vi.hoisted(() => ({
  expenses: [] as unknown[],
  setExpenses: vi.fn(),
  resetExpenses: vi.fn(),
}));

const inventory = vi.hoisted(() => ({
  ingredients: [] as unknown[],
  setIngredients: vi.fn(),
  movements: [] as unknown[],
  setMovements: vi.fn(),
  resetInventory: vi.fn(),
}));

const staff = vi.hoisted(() => ({
  roles: [] as unknown[],
  setRoles: vi.fn(),
  resetRoles: vi.fn(),
}));

const api = vi.hoisted(() => ({
  createOrder: vi.fn(),
  updateOrderStatus: vi.fn(),
  getOrder: vi.fn(),
  listOrders: vi.fn(),
  listTables: vi.fn(),
  listReservations: vi.fn(),
  port: { enviar: vi.fn(), enviarBaja: vi.fn(), setContingencia: vi.fn(), isContingencia: vi.fn() },
}));

vi.mock('./providers/session', () => ({ useSession: () => sesion }));
vi.mock('./providers/notifications', () => ({ useNotifications: () => avisos }));
vi.mock('@/features/tenant/provider', () => ({ useTenant: () => tenant }));
vi.mock('@/features/crm/provider', () => ({ useCrm: () => crm }));
vi.mock('@/features/expenses/provider', () => ({ useExpenses: () => expenses }));
vi.mock('@/features/inventory/provider', () => ({ useInventory: () => inventory }));
vi.mock('@/features/staff/provider', () => ({ useStaff: () => staff }));
vi.mock('./providers/catalog', () => ({ useCatalogoState: () => catalogo }));
vi.mock('@/lib/realtime', () => ({ connectOrdersRealtime: () => () => {} }));
vi.mock('@/lib/orders-api', () => ({
  createOrder: api.createOrder,
  updateOrderStatus: api.updateOrderStatus,
  getOrder: api.getOrder,
  listOrders: api.listOrders,
}));
vi.mock('@/lib/tables-api', () => ({ listTables: api.listTables }));
vi.mock('@/lib/reservations-api', () => ({ listReservations: api.listReservations }));
vi.mock('@/lib/facturacion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/facturacion')>();
  return { ...actual, getFacturacionPort: () => api.port };
});

import { ModulesProvider, useModules } from './ModulesProvider';

let ctx: ReturnType<typeof useModules>;

function Sonda() {
  const value = useModules();
  useEffect(() => {
    ctx = value;
  }, [value]);
  return null;
}

function montar() {
  return render(
    <ModulesProvider initialPayments={[]}>
      <Sonda />
    </ModulesProvider>,
  );
}

const item = (id = 'it-1') => ({
  id,
  productId: 'p-1',
  name: 'Lomo',
  qty: 2,
  unitPrice: 24.9,
  modifiers: [],
  notes: '',
  sent: false,
});

const pagos = (total: number) => [{ method: 'Efectivo' as const, amount: total }];

beforeEach(() => {
  sesion.currentUser = null;
  sesion.hasSession = false;
  tenant.activeBranchId = 'miraflores';
  tenant.writeBranchId = 'miraflores';
  tenant.branchIds = ['miraflores'];
  avisos.notify.mockReset();
  api.port.enviar.mockReset().mockResolvedValue({ estado: 'aceptado', mensaje: 'ok' });
  api.port.enviarBaja.mockReset().mockResolvedValue({ estado: 'aceptado', mensaje: 'ok' });
  api.createOrder.mockReset();
  api.updateOrderStatus.mockReset().mockResolvedValue({});
  api.getOrder.mockReset();
  api.listOrders.mockReset().mockResolvedValue({ items: [] });
  api.listTables.mockReset().mockResolvedValue([]);
  api.listReservations.mockReset().mockResolvedValue({ items: [] });
  localStorage.clear();
});

afterEach(cleanup);

describe('ModulesProvider (con sesión real)', () => {
  const ordenApi = {
    id: 'o-1',
    numero_orden: 'ORD-000001',
    estado: 'POR_CONFIRMAR',
    origen: 'MESA',
    empresa_id: 'e-1',
    sucursal_id: 's-1',
    mesa_id: 'm-1',
    mesero_id: 'u-1',
    subtotal: '24.90',
    descuento_cupon: '0.00',
    total: '24.90',
    created_at: '2026-11-20T12:00:00.000Z',
    confirmacion_at: null,
    listo_at: null,
    entrega_at: null,
    detalles_orden: [],
    mesas: { id: 'm-1', numero: '1', zona: 'Salón' },
    usuarios: { id: 'u-1', nombre: 'Luis' },
  };

  beforeEach(() => {
    sesion.currentUser = {
      id: 'u-1',
      name: 'Luis',
      email: 'luis@fogoneria.pe',
      role: 'mesero',
      empresaId: 'e-1',
      branchId: 's-1',
      initials: 'LU',
    };
    sesion.hasSession = true;
    tenant.activeBranchId = 's-1';
    tenant.writeBranchId = 's-1';
    tenant.branchIds = ['s-1'];
    api.createOrder.mockResolvedValue(ordenApi);
  });

  it('refresca comandas, mesas y reservas desde la API', async () => {
    api.listOrders.mockResolvedValue({ items: [ordenApi] });
    api.listTables.mockResolvedValue([{ id: 'm-1', numero: '1', capacidad: 4, zona: null, estado: 'LIBRE', forma: 'RECTANGULAR', sucursal_id: 's-1' }]);
    api.listReservations.mockResolvedValue({ items: [] });

    montar();
    await waitFor(() => expect(ctx?.ordersLoading).toBe(false));
    expect(api.listOrders).toHaveBeenCalled();
    expect(api.listTables).toHaveBeenCalled();
    expect(api.listReservations).toHaveBeenCalled();
  });

  it('expone errores de refresco de comandas y mesas', async () => {
    api.listOrders.mockRejectedValue(new Error('API caída'));
    api.listTables.mockRejectedValue(new Error('mesas caídas'));
    montar();
    await waitFor(() => expect(ctx.ordersError).toBe('No se pudieron cargar las comandas.'));
    expect(ctx.tablesError).toBe('No se pudieron cargar las mesas.');
  });

  it('envía la comanda a la API y avanza su estado', async () => {
    api.listOrders.mockResolvedValue({ items: [] });
    api.listTables.mockResolvedValue([]);
    api.listReservations.mockResolvedValue({ items: [] });
    montar();
    await waitFor(() => expect(ctx).toBeTruthy());

    let accountId = '';
    act(() => {
      accountId = ctx.openAccount({
        tableId: 1,
        tableApiId: 'm-1',
        label: 'Mesa 1',
        customer: 'Ana',
        waiter: 'Luis',
      }) ?? '';
      ctx.addAccountItems(accountId, [item()]);
    });

    let orden: unknown = null;
    await act(async () => {
      orden = await ctx.sendToKitchen(accountId);
    });
    expect(api.createOrder).toHaveBeenCalled();
    expect(orden).toBeTruthy();

    const creada = orden as { id: string; apiId?: string };
    expect(creada.apiId).toBe('o-1');
    await act(async () => {
      await expect(ctx.advanceOrder(creada as never, 'cocina')).resolves.toBe(true);
    });
    expect(api.updateOrderStatus).toHaveBeenCalledWith('o-1', 'EN_COCINA');
  });

  it('devuelve false y registra el error cuando la API rechaza el avance', async () => {
    api.listOrders.mockResolvedValue({ items: [] });
    api.listTables.mockResolvedValue([]);
    api.listReservations.mockResolvedValue({ items: [] });
    api.updateOrderStatus.mockRejectedValue(new Error('sin permiso'));
    montar();
    await waitFor(() => expect(ctx).toBeTruthy());

    const orden = { id: 'ORD-1', apiId: 'o-1', status: 'pendiente' } as never;
    await act(async () => {
      await expect(ctx.advanceOrder(orden, 'cocina')).resolves.toBe(false);
    });
    expect(ctx.ordersError).toBe('No se pudo actualizar la comanda.');
  });
});

describe('ModulesProvider (modo demo)', () => {
  it('abre cuenta, edita líneas y envía a cocina', async () => {
    montar();
    await waitFor(() => expect(ctx).toBeTruthy());

    let accountId = '';
    act(() => {
      accountId = ctx.openAccount({ tableId: 1, label: 'Mesa 1', customer: 'Ana', waiter: 'Luis' }) ?? '';
    });
    expect(accountId).toBeTruthy();
    expect(ctx.accounts[0]).toMatchObject({ label: 'Mesa 1', status: 'abierta' });

    act(() => {
      ctx.addAccountItems(accountId, [item(), item('it-2')]);
    });
    expect(ctx.accounts[0].items).toHaveLength(2);

    act(() => {
      ctx.updateAccountItem(accountId, 'it-1', 3);
    });
    expect(ctx.accounts[0].items.find((i) => i.id === 'it-1')?.qty).toBe(3);

    act(() => {
      ctx.updateAccountItem(accountId, 'it-2', 0);
    });
    expect(ctx.accounts[0].items).toHaveLength(1);

    let orden: unknown = null;
    await act(async () => {
      orden = await ctx.sendToKitchen(accountId);
    });
    expect(orden).toBeTruthy();
    expect(ctx.accounts[0].items[0].sent).toBe(true);
    expect(api.createOrder).not.toHaveBeenCalled();

    const nueva = ctx.orders[0];
    await act(async () => {
      await expect(ctx.advanceOrder(nueva, 'cocina')).resolves.toBe(true);
    });
    expect(ctx.orders[0].status).toBe('cocina');

    act(() => {
      ctx.annulAccount(accountId, 'Cliente desistió');
    });
    expect(ctx.accounts[0]).toMatchObject({ status: 'anulada', motivoAnulacion: 'Cliente desistió' });
  });

  it('cobra una cuenta con cupón y cliente, y emite comprobante', async () => {
    montar();
    await waitFor(() => expect(ctx).toBeTruthy());

    let accountId = '';
    act(() => {
      accountId = ctx.openAccount({ tableId: null, label: 'Barra', customer: 'Ana', waiter: 'Luis' }) ?? '';
      ctx.addAccountItems(accountId, [item()]);
      ctx.setCoupons([
        { code: 'BURGER10', discount: '10% OFF', used: 0, limit: 10, expires: '30 Nov 2026' },
      ]);
      ctx.setCustomers([
        { id: 1, name: 'Ana', phone: '987654321', points: 0, visits: 0, segment: 'Nuevo', lastVisit: 'Hoy' },
      ]);
    });

    const bruto = ctx.accounts[0].items[0].unitPrice * ctx.accounts[0].items[0].qty;
    let recibo: unknown = null;
    act(() => {
      recibo = ctx.checkoutAccount({
        accountId,
        payments: pagos(44.82),
        tip: 5,
        receiptType: '03',
        docType: '',
        docNumber: '',
        customerId: 1,
        couponCode: 'BURGER10',
      });
    });

    expect(recibo).toBeTruthy();
    expect(ctx.receipts[0]).toMatchObject({ status: 'Pagada', total: 44.82 });
    expect(ctx.accounts[0]).toMatchObject({ status: 'cobrada', tip: 5 });
    expect(ctx.coupons[0].used).toBe(1);
    expect(ctx.customers[0].points).toBeGreaterThan(0);
    expect(ctx.cashMovements.some((m) => m.concept.startsWith('Cobro'))).toBe(true);
    expect(bruto).toBeGreaterThan(0);
    await waitFor(() => expect(api.port.enviar).toHaveBeenCalled());
  });

  it('abre y cierra el turno de caja con arqueo', async () => {
    montar();
    await waitFor(() => expect(ctx).toBeTruthy());

    // El demo arranca con un turno abierto; se cierra y luego se abre uno nuevo.
    const inicial = ctx.openCashShift!;
    act(() => {
      ctx.closeCashShift(100, 'Cuadra');
    });
    expect(ctx.cashShifts.find((s) => s.id === inicial.id)).toMatchObject({
      status: 'cerrado',
      countedCash: 100,
      observations: 'Cuadra',
    });

    act(() => {
      ctx.startCashShift(100);
    });
    expect(ctx.openCashShift).toMatchObject({ openingFund: 100, status: 'abierto' });
    expect(ctx.cashMovements.some((m) => m.concept === 'Fondo de apertura')).toBe(true);

    const nuevo = ctx.openCashShift!;
    act(() => {
      ctx.closeCashShift(120, 'Sobra cambio');
    });
    expect(ctx.cashShifts.find((s) => s.id === nuevo.id)).toMatchObject({
      status: 'cerrado',
      countedCash: 120,
      observations: 'Sobra cambio',
    });
  });

  it('alterna contingencia SUNAT, envía comprobantes y genera resumen', async () => {
    montar();
    await waitFor(() => expect(ctx).toBeTruthy());

    expect(ctx.sunatContingencia).toBe(false);
    act(() => {
      ctx.toggleSunatContingencia();
    });
    expect(ctx.sunatContingencia).toBe(true);

    const recibo = {
      id: 'B001-1',
      type: '03',
      at: new Date().toISOString(),
      date: 'Hoy',
      customer: 'Ana',
      docType: '',
      docNumber: '',
      subtotal: 50,
      igv: 9,
      total: 59,
      status: 'Emitida',
      source: 'Mesa 1',
      estadoSunat: 'en_cola',
      intentosEnvio: 0,
      bajaResumenId: 'RC-pendiente',
    } as const;

    act(() => {
      ctx.enviarSunat({ ...recibo });
    });
    await waitFor(() => expect(api.port.enviar).toHaveBeenCalled());

    act(() => {
      ctx.setReceipts([{ ...recibo, status: 'Anulada', bajaResumenId: 'RC-pendiente' }]);
    });
    const resumen = ctx.generarResumenDiario();
    expect(resumen).toBeTruthy();
    expect(resumen?.count).toBeGreaterThan(0);
  });

  it('anula un comprobante y revierte sus movimientos', async () => {
    montar();
    await waitFor(() => expect(ctx).toBeTruthy());

    act(() => {
      ctx.setReceipts([
        {
          id: 'B001-7',
          type: '03',
          at: new Date().toISOString(),
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
      ]);
      ctx.setCashMovements([
        {
          id: 1,
          at: new Date().toISOString(),
          datetime: 'Hoy',
          concept: 'Cobro Mesa 1',
          kind: 'Ingreso',
          amount: 59,
          method: 'Efectivo',
        },
      ]);
    });

    act(() => {
      ctx.annulReceipt('B001-7', 'Duplicado');
    });
    expect(ctx.receipts[0]).toMatchObject({ status: 'Anulada', motivoAnulacion: 'Duplicado' });
    expect(ctx.cashMovements.some((m) => m.kind === 'Egreso' && m.amount === 59)).toBe(true);

    act(() => {
      ctx.annulReceipt('B001-7', 'Otra vez');
    });
    expect(ctx.receipts[0].motivoAnulacion).toBe('Duplicado');
  });

  it('cubre rechazos de SUNAT, tickets y ramas sin pendientes', async () => {
    montar();
    await waitFor(() => expect(ctx).toBeTruthy());

    act(() => {
      ctx.toggleSunatContingencia();
      ctx.toggleSunatContingencia();
    });
    expect(ctx.sunatContingencia).toBe(false);
    act(() => {
      ctx.setReceipts([]);
    });
    expect(ctx.generarResumenDiario()).toBeNull();

    act(() => {
      ctx.addTicket('No imprime');
    });
    expect(ctx.tickets[0]).toMatchObject({ subject: 'No imprime' });

    const recibo = {
      id: 'B001-9',
      type: '03',
      at: new Date().toISOString(),
      date: 'Hoy',
      customer: 'Ana',
      docType: '',
      docNumber: '',
      subtotal: 50,
      igv: 9,
      total: 59,
      status: 'Emitida',
      source: 'Mesa 1',
      estadoSunat: 'en_cola',
      intentosEnvio: 0,
    } as const;

    api.port.enviar.mockResolvedValueOnce({ estado: 'rechazado', mensaje: 'RUC inválido' });
    act(() => {
      ctx.enviarSunat({ ...recibo });
    });
    await waitFor(() => expect(api.port.enviar).toHaveBeenCalled());

    api.port.enviar.mockResolvedValueOnce({ estado: 'en_cola', mensaje: 'OSE caído' });
    act(() => {
      ctx.enviarSunat({ ...recibo, id: 'B001-10' });
    });
    await waitFor(() => expect(api.port.enviar).toHaveBeenCalledTimes(2));

    act(() => {
      ctx.notify('Aviso', 'Mensaje');
      ctx.clearUnread();
    });
    expect(avisos.notify).toHaveBeenCalledWith('Aviso', 'Mensaje');
  });

  it('reinicia la demo y deja el estado inicial', async () => {
    montar();
    await waitFor(() => expect(ctx).toBeTruthy());

    act(() => {
      ctx.openAccount({ tableId: null, label: 'Barra', customer: '', waiter: '' });
    });
    expect(ctx.accounts).toHaveLength(1);

    act(() => {
      ctx.resetDemoData();
    });
    expect(ctx.accounts).toHaveLength(0);
  });
});
