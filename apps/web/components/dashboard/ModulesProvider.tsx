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
import {
  initialTickets,
  type Notification,
  type Payment as PlanPayment,
  type Ticket,
} from "@/lib/dashboard";
import {
  initialCoupons,
  initialReceipts,
  initialReservations,
  type CashMovement,
  type Coupon,
  type Customer,
  type Expense,
  type Ingredient,
  type Order,
  type OrderStatus,
  type Receipt,
  type ReceiptType,
  type Reservation,
  type Role,
  type StockMovement,
  type Table,
} from "@/lib/erp";
import {
  DEMO_EMPRESA_ID,
  GENERAL_BRANCH,
  SEED_BRANCH_SLUGS,
  SEED_SLUG_BRANCH_IDS,
  demoScopeFor,
  initialCashShifts,
  initialScopes,
  type Branch,
  type BranchScope,
} from "@/lib/tenancy";
import type { Tenant } from "@/lib/tenant-api";
import type { AppUser } from "@/lib/auth";
import {
  accountTotals,
  expectedCashFor,
  fmtDateTime,
  itemLineTotal,
  newId,
  nextReceiptNumber,
  nowIso,
  parseCouponDiscount,
  round2,
  splitIgv,
  type AccountItem,
  type CashShift,
  type Payment,
  type PaymentMethod,
  type TableAccount,
} from "@/lib/domain";
import {
  initialCombos,
  type Combo,
  type ModifierGroup,
  type PriceList,
  type Product,
  type ProductCategory,
} from "@/lib/erp-catalog";
import { ApiError } from "@/lib/api";
import {
  migrateLegacyCustomers,
  readCrmCustomers,
  saveCrmCustomers,
  type LegacyErpState,
} from "@/lib/crm-storage";
import {
  migrateLegacyArray,
  migrateLegacyInventory,
  readModuleValue,
  saveModuleValue,
  type InventoryStoreState,
  type LegacyErpState as LegacyModuleState,
} from "@/lib/module-store";
import { tenantKeyOf } from "@/lib/session-state";
import { matchesBranch } from "@/lib/tenant-scope";
import { useCatalogoState } from "./providers/catalog";
import { useCrm } from "@/features/crm/provider";
import { useExpenses } from "@/features/expenses/provider";
import { useInventory } from "@/features/inventory/provider";
import { useAccounts } from "@/features/orders/provider";
import { useStaff } from "@/features/staff/provider";
import { useNotifications } from "./providers/notifications";
import { useSession } from "./providers/session";
import { useTenant } from "@/features/tenant/provider";
import * as ordersApi from "@/lib/orders-api";
import {
  UI_TO_API_STATUS,
  orderFromApi,
  orderItemsFromAccount,
  reconcileAccounts,
} from "@/lib/order-mapping";
import { connectOrdersRealtime } from "@/lib/realtime";
import { listReservations } from "@/lib/reservations-api";
import { limaTodayKey, reservationsFromApi, tablesFromApi } from "@/lib/table-mapping";
import { listTables } from "@/lib/tables-api";
import {
  cpeFromReceipt,
  getFacturacionPort,
} from "@/lib/facturacion";
import {
  loadErpState,
  saveErpState,
  resetErpState,
  subscribeErpSync,
  broadcastErpState,
  type ErpState,
} from "@/lib/persistence";

const TERMINAL_API_STATES: readonly ordersApi.ApiOrderStatus[] = [
  "PAGADA",
  "CERRADA",
  "ANULADA",
];

export type CheckoutInput = {
  accountId: string;
  payments: { method: PaymentMethod; amount: number }[];
  tip: number;
  couponCode: string | null;
  customerId: number | null;
  receiptType: ReceiptType;
  docType: "1" | "6" | "";
  docNumber: string;
};

/* El tipo se mantiene exportado desde aquí por compatibilidad; el estado de
   catálogo vive en `CatalogoProvider` (Fase 4 etapa 3). */
import type { CatalogoActions } from "./providers/catalog";

export type { ProductInput } from "./providers/catalog";

type ModulesContext = CatalogoActions & {
  payments: PlanPayment[];
  tickets: Ticket[];
  addTicket: (subject: string) => void;
  setTickets: (tickets: Ticket[]) => void;
  /* Maestros de catálogo (ERP): la fuente de verdad es la API (tarea 63) */
  products: Product[];
  categories: ProductCategory[];
  modifierGroups: ModifierGroup[];
  priceLists: PriceList[];
  catalogLoading: boolean;
  catalogError: string | null;
  /* Multitenant: sucursales de la empresa (1 RUC → N locales + vista general) */
  company: { legalName: string; ruc: string };
  tenant: Tenant | null;
  branches: Branch[];
  activeBranch: Branch;
  activeBranchId: string;
  isGeneral: boolean;
  setActiveBranch: (id: string) => void;
  branchOf: (kind: keyof BranchScope, id: number | string) => Branch | null;
  /* Operación por sucursal (órdenes, mesas, caja) */
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  /** Comandas reales de la API (AYCDS-25): solo con sesión. */
  ordersLoading: boolean;
  ordersError: string | null;
  refreshOrders: () => Promise<void>;
  /** Crea la comanda de las líneas pendientes de la cuenta (POST /orders). */
  createOrderFromAccount: (accountId: string) => Promise<Order | null>;
  /** Avanza el estado de una comanda (PATCH /orders/:id/status o local en demo). */
  advanceOrder: (order: Order, next: OrderStatus) => Promise<boolean>;
  tables: Table[];
  setTables: React.Dispatch<React.SetStateAction<Table[]>>;
  /** Mesas reales de la API (AYCDS-26): `true` con sesión. */
  tablesLoading: boolean;
  tablesError: string | null;
  refreshTables: () => Promise<void>;
  roles: Role[];
  setRoles: (r: Role[]) => void;
  /* Reservas e inventario (persisten al navegar) */
  reservations: Reservation[];
  setReservations: (r: Reservation[]) => void;
  /** Agenda real de la API (AYCDS-26): filtra por día en hora de Lima. */
  reservationsLoading: boolean;
  reservationsError: string | null;
  refreshReservations: (fecha?: string) => Promise<void>;
  /** Hay empresa en el token: las vistas operan contra la API, no contra mocks. */
  hasSession: boolean;
  ingredients: Ingredient[];
  setIngredients: (i: Ingredient[]) => void;
  movements: StockMovement[];
  setMovements: (m: StockMovement[]) => void;
  /* Fidelización y clientes */
  customers: Customer[];
  setCustomers: (c: Customer[]) => void;
  coupons: Coupon[];
  setCoupons: (c: Coupon[]) => void;
  /* Dinero: caja, comprobantes y gastos */
  cashMovements: CashMovement[];
  setCashMovements: React.Dispatch<React.SetStateAction<CashMovement[]>>;
  receipts: Receipt[];
  setReceipts: (r: Receipt[]) => void;
  annulReceipt: (id: string, motivo: string) => void;
  /* Facturación electrónica SUNAT */
  enviarSunat: (receipt: Receipt) => void;
  generarResumenDiario: () => { count: number; resumenId: string } | null;
  sunatContingencia: boolean;
  toggleSunatContingencia: () => void;
  expenses: Expense[];
  setExpenses: (e: Expense[]) => void;
  combos: Combo[];
  setCombos: (c: Combo[]) => void;
  /* Cuentas de mesa (operación del turno) */
  accounts: TableAccount[];
  openAccount: (input: {
    tableId: number | null;
    tableApiId?: string | null;
    label: string;
    customer: string;
    waiter: string;
  }) => string | null;
  addAccountItems: (accountId: string, items: AccountItem[]) => void;
  updateAccountItem: (accountId: string, itemId: string, qty: number) => void;
  removeAccountItem: (accountId: string, itemId: string) => void;
  sendToKitchen: (accountId: string) => Promise<Order | null>;
  annulAccount: (accountId: string, motivo: string) => void;
  checkoutAccount: (input: CheckoutInput) => Receipt | null;
  /* Turno de caja */
  cashShifts: CashShift[];
  openCashShift: CashShift | null;
  startCashShift: (fund: number) => void;
  closeCashShift: (countedCash: number, observations: string) => void;
  /* Notificaciones */
  notifications: Notification[];
  hasUnread: boolean;
  notify: (title: string, message: string) => void;
  clearUnread: () => void;
  /* Demo: volver al estado inicial */
  resetDemoData: () => void;
  /* Sesión real (JWT de la API) */
  currentUser: AppUser | null;
  login: (email: string, password: string) => Promise<AppUser>;
  logout: () => void;
};

const Ctx = createContext<ModulesContext | null>(null);

type ScopeItem = { id: number | string };

function applyWrite(
  prev: Record<string, BranchScope>,
  branchIds: string[],
  activeId: string,
  key: "orders",
  value: React.SetStateAction<Order[]>,
): Record<string, BranchScope>;
function applyWrite(
  prev: Record<string, BranchScope>,
  branchIds: string[],
  activeId: string,
  key: "tables",
  value: React.SetStateAction<Table[]>,
): Record<string, BranchScope>;
function applyWrite(
  prev: Record<string, BranchScope>,
  branchIds: string[],
  activeId: string,
  key: "cash",
  value: React.SetStateAction<CashMovement[]>,
): Record<string, BranchScope>;
function applyWrite(
  prev: Record<string, BranchScope>,
  branchIds: string[],
  activeId: string,
  key: "orders" | "tables" | "cash",
  value: unknown,
): Record<string, BranchScope> {
  const asItems = value as React.SetStateAction<ScopeItem[]>;
  if (activeId !== "todas") {
    const current = ((prev[activeId]?.[key] ?? []) as ScopeItem[]);
    const next = typeof asItems === "function" ? asItems(current) : asItems;
    return { ...prev, [activeId]: { ...prev[activeId], [key]: next } };
  }
  // Vista general: se aplica sobre el combinado y se reparte por id;
  // los ítems nuevos (id desconocido) van a la matriz.
  const combined = branchIds.flatMap((id) => ((prev[id]?.[key] ?? []) as ScopeItem[]));
  const next = typeof asItems === "function" ? asItems(combined) : asItems;
  const knownIds = new Set(combined.map((o) => o.id));
  const fresh = next.filter((o) => !knownIds.has(o.id));
  const out = { ...prev };
  branchIds.forEach((id, i) => {
    const own = new Set((((prev[id] as BranchScope | undefined)?.[key] ?? []) as ScopeItem[]).map((o) => o.id));
    const slice = next.filter((o) => own.has(o.id));
    out[id] = { ...out[id], [key]: i === 0 ? [...slice, ...fresh] : slice };
  });
  return out;
}

/**
 * Alinea la operación mock con las sucursales reales: el tenant demo del seed
 * recibe sus datos de ejemplo (remapeados a UUID) y los tenants nuevos arrancan
 * con la operación vacía.
 */
function prepareOps(state: ErpState, branchIds: string[]): ErpState {
  const scopes = { ...state.scopes };
  for (const id of branchIds) {
    if (!scopes[id]) scopes[id] = demoScopeFor(id) ?? { orders: [], tables: [], cash: [] };
  }
  const remap = (branchId: string) => SEED_SLUG_BRANCH_IDS[branchId] ?? branchId;
  return {
    ...state,
    scopes,
    cashShifts: state.cashShifts.map((shift) => ({ ...shift, branchId: remap(shift.branchId) })),
  };
}

/**
 * Remapea las cuentas del seed (slug) a las sucursales reales (UUID).
 * Idempotente: devuelve el mismo array si no hay nada que remapear.
 */
function remapAccountBranches(accounts: TableAccount[]): TableAccount[] {
  let changed = false;
  const next = accounts.map((account) => {
    const branchId = SEED_SLUG_BRANCH_IDS[account.branchId] ?? account.branchId;
    if (branchId === account.branchId) return account;
    changed = true;
    return { ...account, branchId };
  });
  return changed ? next : accounts;
}

/** Estado de arranque de un tenant nuevo: sin mocks compartidos. */
function buildEmptyState(): ErpState {
  return {
    version: 2,
    reservations: [],
    coupons: [],
    receipts: [],
    combos: [],
    tickets: [],
    scopes: {},
    cashShifts: [],
    sunatContingencia: false,
  };
}

/** Estado inicial: demo para offline o el tenant demo del seed; vacío para el resto. */
function buildInitialState(empresaId: string | null): ErpState {
  if (empresaId !== null && empresaId !== DEMO_EMPRESA_ID) return buildEmptyState();
  return {
    version: 2,
    reservations: initialReservations,
    coupons: initialCoupons,
    receipts: initialReceipts,
    combos: initialCombos,
    tickets: initialTickets,
    scopes: initialScopes,
    cashShifts: initialCashShifts,
    sunatContingencia: false,
  };
}

export function ModulesProvider({
  children,
  initialPayments,
}: {
  children: React.ReactNode;
  initialPayments: PlanPayment[];
}) {
  const { currentUser, hasSession, login, logout } = useSession();
  const { notifications, hasUnread, notify, clearUnread } = useNotifications();
  /* Tenant (empresa/sucursales) desde la Fase 4 etapa 2; se reexpone abajo. */
  const {
    tenant,
    company,
    branches,
    realBranches,
    branchIds,
    activeBranch,
    activeBranchId,
    isGeneral,
    setActiveBranch,
    loading: tenantLoading,
    error: tenantError,
  } = useTenant();
  const { customers, setCustomers, addPoints, resetCustomers } = useCrm();
  const { expenses, setExpenses, resetExpenses } = useExpenses();
  const {
    ingredients,
    setIngredients,
    movements,
    setMovements,
    resetInventory,
  } = useInventory();
  const { roles, setRoles, resetRoles } = useStaff();
  const { accounts, setAccounts, resetAccounts } = useAccounts();
  const [payments] = useState<PlanPayment[]>(initialPayments);
  const [state, setState] = useState<ErpState>(() => buildInitialState(null));
  const applyingRemote = useRef(false);
  /** Namespace de persistencia: una empresa no comparte estado con otra. */
  const tenantKey = tenantKeyOf(currentUser);
  const empresaId = currentUser?.empresaId ?? null;

  /* Al cambiar de empresa, carga su estado aislado (o arranca demo/vacío). */
  useEffect(() => {
    const saved = loadErpState(tenantKey) as LegacyErpState | null;
    if (!saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación por tenant
      setState(buildInitialState(currentUser?.empresaId ?? null));
      return;
    }

    // Migra los slices que ya tienen provider antes de que el guardado escriba.
    let next = saved as LegacyModuleState;
    let changed = false;

    const crm = migrateLegacyCustomers(
      next as LegacyErpState,
      readCrmCustomers(tenantKey),
    );
    if (crm.migrated) {
      saveCrmCustomers(tenantKey, crm.migrated);
      next = crm.state as LegacyModuleState;
      changed = true;
    }

    const expensesMigration = migrateLegacyArray(
      next,
      "expenses",
      readModuleValue<Expense[]>("expenses", tenantKey),
    );
    if (expensesMigration.migrated) {
      saveModuleValue("expenses", tenantKey, expensesMigration.migrated);
      next = expensesMigration.state as LegacyModuleState;
      changed = true;
    }

    const inventoryMigration = migrateLegacyInventory(
      next,
      readModuleValue<InventoryStoreState>("inventory", tenantKey),
    );
    if (inventoryMigration.migrated) {
      saveModuleValue("inventory", tenantKey, inventoryMigration.migrated);
      next = inventoryMigration.state as LegacyModuleState;
      changed = true;
    }

    const staffMigration = migrateLegacyArray(
      next,
      "roles",
      readModuleValue<Role[]>("staff", tenantKey),
    );
    if (staffMigration.migrated) {
      saveModuleValue("staff", tenantKey, staffMigration.migrated);
      next = staffMigration.state as LegacyModuleState;
      changed = true;
    }

    const accountsMigration = migrateLegacyArray(
      next,
      "accounts",
      readModuleValue<TableAccount[]>("orders", tenantKey),
    );
    if (accountsMigration.migrated) {
      saveModuleValue("orders", tenantKey, accountsMigration.migrated);
      next = accountsMigration.state as LegacyModuleState;
      changed = true;
    }

    if (changed) saveErpState(tenantKey, next as ErpState);
    setState(next as ErpState);
  }, [tenantKey, currentUser]);

  /* Alinea la operación demo con las sucursales reales cuando llegan de la API. */
  const preparedBranches = useRef<string | null>(null);
  useEffect(() => {
    if (!hasSession || tenantLoading || tenantError || !empresaId) return;
    const ids = realBranches.map((branch) => branch.id);
    const signature = `${empresaId}:${ids.join(",")}`;
    if (preparedBranches.current === signature) return;
    preparedBranches.current = signature;
    setState((prev) => prepareOps(prev, ids));
  }, [hasSession, tenantLoading, tenantError, empresaId, realBranches]);

  /**
   * Remapeo slug→UUID de las cuentas (F6c1). Corre cuando cambian las cuentas
   * (hidratación del provider) o las sucursales reales, sin depender de
   * `preparedBranches`: si `realBranches` ya está al montar remapea lo cargado,
   * y si llega después remapea entonces. Es idempotente: un UUID no está en el
   * mapa y, si nada cambia, devuelve el mismo array (sin re-render).
   */
  useEffect(() => {
    if (!hasSession || tenantLoading || tenantError || !empresaId) return;
    if (realBranches.length === 0) return;
    setAccounts(remapAccountBranches);
  }, [
    accounts,
    activeBranchId,
    empresaId,
    hasSession,
    realBranches,
    setAccounts,
    tenantError,
    tenantLoading,
  ]);

  /* Persistir + difundir a otras pestañas de la misma empresa */
  useEffect(() => {
    saveErpState(tenantKey, state);
    if (applyingRemote.current) {
      applyingRemote.current = false;
      return;
    }
    broadcastErpState(tenantKey, state);
  }, [state, tenantKey]);

  /* Estado compartido entre pestañas del mismo tenant (mesero ↔ cocina) */
  useEffect(() => {
    return subscribeErpSync(tenantKey, (msg) => {
      applyingRemote.current = true;
      setState(msg.type === "state" ? msg.state : buildInitialState(currentUser?.empresaId ?? null));
    });
  }, [tenantKey, currentUser]);

  /* ---------- Catálogo y precios (Fase 4 etapa 3: `CatalogoProvider`) ---------- */

  const {
    products,
    categories,
    modifierGroups,
    priceLists,
    catalogLoading,
    catalogError,
    catalogVersion,
    refreshCatalog,
    saveProduct,
    setProductActive,
    saveCategory,
    deleteCategory,
    createModifierGroup,
    updateModifierGroup,
    deleteModifierGroup,
    createPriceList,
    activatePriceList,
    setPrice,
    priceOf,
    categoryNameOf,
  } = useCatalogoState();

  /**
   * Poda de combos: los combos del seed apuntan a platos del tenant demo, así
   * que en un tenant nuevo se descartan para no mostrar "Plato retirado".
   * Antes vivía dentro de `refreshCatalog`; como el catálogo ya no es de este
   * provider, el dueño de los combos reacciona a cada snapshot exitoso
   * (`catalogVersion`), igual que antes.
   */
  const prunedCombos = useRef<{ key: string; version: number } | null>(null);
  useEffect(() => {
    if (!hasSession || catalogVersion === 0) return;
    if (prunedCombos.current?.key === tenantKey && prunedCombos.current.version === catalogVersion) {
      return;
    }
    prunedCombos.current = { key: tenantKey, version: catalogVersion };
    const ids = new Set(products.map((product) => product.id));
    setState((prev) => {
      const combos = prev.combos.filter((combo) =>
        combo.productIds.every((productId) => ids.has(productId)),
      );
      return combos.length === prev.combos.length ? prev : { ...prev, combos };
    });
  }, [hasSession, catalogVersion, products, tenantKey]);

  /* ---------- Comandas reales de la API (AYCDS-25) ---------- */

  /**
   * Comandas de la API. `null` = sin sesión real (demo): las vistas usan el
   * estado local del `scopes` como hasta ahora.
   */
  const [liveOrders, setLiveOrders] = useState<Order[] | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  /** Descarta respuestas que llegan después de una recarga más nueva. */
  const ordersRequest = useRef(0);

  /** `detalles_orden` solo trae `plato_id`: el nombre sale del catálogo. */
  const platoNames = useMemo(
    () => new Map(products.map((product) => [product.id, product.name])),
    [products],
  );
  const platoNameOf = useCallback(
    (platoId: string | null, tipo: string): string =>
      (platoId ? platoNames.get(platoId) : undefined) ?? (tipo === "COMBO" ? "Combo" : "Plato"),
    [platoNames],
  );

  const refreshOrders = useCallback(
    async (signal?: AbortSignal) => {
      if (!currentUser?.empresaId) {
        setLiveOrders(null);
        return;
      }
      const requestId = ++ordersRequest.current;
      setOrdersLoading(true);
      setOrdersError(null);
      try {
        const list = await ordersApi.listOrders({
          // `todas` es una vista agregada: sin filtro la API devuelve la empresa.
          sucursalId: activeBranchId !== GENERAL_BRANCH.id ? activeBranchId : undefined,
          limit: 100,
          signal,
        });
        if (requestId !== ordersRequest.current) return;
        setLiveOrders(list.items.map((order) => orderFromApi(order, { nameOf: platoNameOf })));
        setAccounts((prev) => reconcileAccounts(prev, list.items, platoNameOf));
      } catch (error) {
        if (requestId !== ordersRequest.current || signal?.aborted) return;
        setOrdersError(
          error instanceof ApiError ? error.message : "No se pudieron cargar las comandas.",
        );
      } finally {
        if (requestId === ordersRequest.current) setOrdersLoading(false);
      }
    },
    [activeBranchId, currentUser, platoNameOf, setAccounts],
  );

  /* Cargar comandas al iniciar sesión y al cambiar de sucursal. */
  useEffect(() => {
    if (!currentUser?.empresaId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpiar comandas al cerrar sesión
      setLiveOrders(null);
      setOrdersError(null);
      return;
    }
    const controller = new AbortController();
    void refreshOrders(controller.signal);
    return () => controller.abort();
  }, [currentUser, refreshOrders]);

  /* Sincronización en tiempo real de órdenes y mesas para todo el sistema */
  useEffect(() => {
    if (!currentUser?.empresaId) return;

    const stop = connectOrdersRealtime({
      onOrderCreated: () => {
        void refreshOrders();
      },
      onOrderUpdated: () => {
        void refreshOrders();
      },
      onTableStatus: () => {
        void refreshOrders();
      },
    });

    return stop;
  }, [currentUser?.empresaId, refreshOrders]);

  /* ---------- Mesas y reservas reales de la API (AYCDS-26) ---------- */

  const [liveTables, setLiveTables] = useState<Table[] | null>(null);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const tablesRequest = useRef(0);
  /** Espejo sincrónico para mapear reservas sin esperar al siguiente render. */
  const tablesRef = useRef<Table[]>([]);

  const refreshTables = useCallback(
    async (signal?: AbortSignal) => {
      if (!currentUser?.empresaId) {
        tablesRef.current = [];
        setLiveTables(null);
        setTablesError(null);
        setTablesLoading(false);
        return;
      }
      const requestId = ++tablesRequest.current;
      setTablesLoading(true);
      setTablesError(null);
      try {
        const list = await listTables({
          // `todas` es la vista agregada: sin filtro la API devuelve la empresa.
          sucursalId: activeBranchId !== GENERAL_BRANCH.id ? activeBranchId : undefined,
          signal,
        });
        if (requestId !== tablesRequest.current) return;
        const mapped = tablesFromApi(list);
        tablesRef.current = mapped;
        setLiveTables(mapped);
      } catch (error) {
        if (requestId !== tablesRequest.current || signal?.aborted) return;
        setTablesError(
          error instanceof ApiError ? error.message : "No se pudieron cargar las mesas.",
        );
      } finally {
        if (requestId === tablesRequest.current) setTablesLoading(false);
      }
    },
    [activeBranchId, currentUser],
  );

  const [liveReservations, setLiveReservations] = useState<Reservation[] | null>(null);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [reservationsError, setReservationsError] = useState<string | null>(null);
  const reservationsRequest = useRef(0);
  const reservationsDay = useRef(limaTodayKey());

  const refreshReservations = useCallback(
    async (fecha?: string, signal?: AbortSignal) => {
      if (!currentUser?.empresaId) {
        setLiveReservations(null);
        setReservationsError(null);
        setReservationsLoading(false);
        return;
      }
      const day = fecha ?? reservationsDay.current;
      reservationsDay.current = day;
      const requestId = ++reservationsRequest.current;
      setReservationsLoading(true);
      setReservationsError(null);
      try {
        const list = await listReservations({ fecha: day, limit: 100, signal });
        if (requestId !== reservationsRequest.current) return;
        setLiveReservations(reservationsFromApi(list.items, tablesRef.current));
      } catch (error) {
        if (requestId !== reservationsRequest.current || signal?.aborted) return;
        setReservationsError(
          error instanceof ApiError ? error.message : "No se pudieron cargar las reservas.",
        );
      } finally {
        if (requestId === reservationsRequest.current) setReservationsLoading(false);
      }
    },
    [currentUser],
  );

  /* Cargar mesas y la agenda de hoy al iniciar sesión o cambiar de sucursal. */
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      await refreshTables(controller.signal);
      await refreshReservations(undefined, controller.signal);
    })();
    return () => controller.abort();
  }, [currentUser, refreshTables, refreshReservations]);

  const writeBranchId = isGeneral ? branchIds[0] : activeBranchId;

  const activeScope: BranchScope = useMemo(() => {
    if (!isGeneral) return scopesOf(state.scopes, activeBranchId);
    return {
      orders: branchIds.flatMap((id) => state.scopes[id]?.orders ?? []),
      tables: branchIds.flatMap((id) => state.scopes[id]?.tables ?? []),
      cash: branchIds.flatMap((id) => state.scopes[id]?.cash ?? []),
    };
  }, [state.scopes, activeBranchId, isGeneral, branchIds]);

  const activeAccounts = useMemo(
    () => (isGeneral ? accounts : accounts.filter((a) => matchesBranch(a.branchId, activeBranchId))),
    [accounts, activeBranchId, isGeneral],
  );

  const cashShifts = useMemo(
    () => (isGeneral ? state.cashShifts : state.cashShifts.filter((s) => s.branchId === activeBranchId)),
    [state.cashShifts, activeBranchId, isGeneral],
  );

  const openCashShift = useMemo(
    () => state.cashShifts.find((s) => s.branchId === writeBranchId && s.status === "abierto") ?? null,
    [state.cashShifts, writeBranchId],
  );

  const branchOf = useCallback(
    (kind: keyof BranchScope, id: number | string): Branch | null => {
      for (const b of branches) {
        const list = (state.scopes[b.id]?.[kind] ?? []) as Array<{ id: number | string }>;
        if (list.some((o) => o.id === id)) return b;
      }
      return branches.find((b) => b.id !== GENERAL_BRANCH.id) ?? null;
    },
    [state.scopes, branches],
  );

  /* ---------- Setters (API compatible con las vistas) ---------- */

  const setPlain = useCallback(<K extends keyof ErpState>(key: K, value: ErpState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  }, []);

  const setOrders = useCallback<React.Dispatch<React.SetStateAction<Order[]>>>(
    (v) => setState((s) => ({ ...s, scopes: applyWrite(s.scopes, branchIds, activeBranchId, "orders", v) })),
    [activeBranchId, branchIds],
  );
  const setTables = useCallback<React.Dispatch<React.SetStateAction<Table[]>>>(
    (v) => setState((s) => ({ ...s, scopes: applyWrite(s.scopes, branchIds, activeBranchId, "tables", v) })),
    [activeBranchId, branchIds],
  );
  const setCashMovements = useCallback<React.Dispatch<React.SetStateAction<CashMovement[]>>>(
    (v) => setState((s) => ({ ...s, scopes: applyWrite(s.scopes, branchIds, activeBranchId, "cash", v) })),
    [activeBranchId, branchIds],
  );
  const setReservations = useCallback((r: Reservation[]) => setPlain("reservations", r), [setPlain]);
  const setCoupons = useCallback((c: Coupon[]) => setPlain("coupons", c), [setPlain]);
  const setReceipts = useCallback((r: Receipt[]) => setPlain("receipts", r), [setPlain]);
  const setCombos = useCallback((c: Combo[]) => setPlain("combos", c), [setPlain]);
  const setTickets = useCallback((t: Ticket[]) => setPlain("tickets", t), [setPlain]);

  const addTicket = useCallback(
    (subject: string) => {
      const ticket: Ticket = {
        id: `#TK-${Math.floor(Math.random() * 9000) + 1000}`,
        subject,
        status: "Enviado",
        updated: "Justo ahora",
      };
      setState((s) => ({ ...s, tickets: [ticket, ...s.tickets] }));
      notify("Ticket enviado", `Tu solicitud "${subject}" ha sido enviada a soporte.`);
    },
    [notify],
  );

  const resetDemoData = useCallback(() => {
    resetErpState(tenantKey);
    resetCustomers();
    resetExpenses();
    resetInventory();
    resetRoles();
    resetAccounts();
    setState(buildInitialState(currentUser?.empresaId ?? null));
    void refreshCatalog();
  }, [
    currentUser,
    refreshCatalog,
    resetAccounts,
    resetCustomers,
    resetExpenses,
    resetInventory,
    resetRoles,
    tenantKey,
  ]);

  /* ---------- Cuentas de mesa ---------- */

  const openAccount = useCallback(
    (input: {
      tableId: number | null;
      tableApiId?: string | null;
      label: string;
      customer: string;
      waiter: string;
    }): string | null => {
      const id = newId("CT");
      const account: TableAccount = {
        id,
        branchId: writeBranchId,
        tableId: input.tableId,
        tableApiId: input.tableApiId ?? null,
        label: input.label,
        customer: input.customer,
        waiter: input.waiter,
        openedAt: nowIso(),
        closedAt: null,
        status: "abierta",
        items: [],
        payments: [],
        tip: 0,
        discount: 0,
        discountConcept: "",
        couponCode: null,
        customerId: null,
        motivoAnulacion: null,
      };
      setAccounts((prev) => [account, ...prev]);
      if (input.tableId) {
        setState((s) => ({
          ...s,
          scopes: patchTableStatus(s.scopes, writeBranchId, input.tableId!, "ocupada"),
        }));
      }
      return id;
    },
    [setAccounts, writeBranchId],
  );

  const patchAccount = useCallback(
    (accountId: string, fn: (a: TableAccount) => TableAccount) => {
      setAccounts((prev) => prev.map((a) => (a.id === accountId ? fn(a) : a)));
    },
    [setAccounts],
  );

  const addAccountItems = useCallback(
    (accountId: string, items: AccountItem[]) => {
      patchAccount(accountId, (a) => ({ ...a, items: [...a.items, ...items] }));
    },
    [patchAccount],
  );

  const updateAccountItem = useCallback(
    (accountId: string, itemId: string, qty: number) => {
      patchAccount(accountId, (a) => ({
        ...a,
        items:
          qty <= 0
            ? a.items.filter((i) => i.id !== itemId)
            : a.items.map((i) => (i.id === itemId ? { ...i, qty } : i)),
      }));
    },
    [patchAccount],
  );

  const removeAccountItem = useCallback(
    (accountId: string, itemId: string) => {
      patchAccount(accountId, (a) => ({ ...a, items: a.items.filter((i) => i.id !== itemId) }));
    },
    [patchAccount],
  );

  /** Modo demo (sin sesión): arma la comanda en el estado local. */
  const localSendToKitchen = useCallback(
    (accountId: string): Order | null => {
      const account = accounts.find((a) => a.id === accountId);
      const pending = account?.items.filter((i) => !i.sent) ?? [];
      if (!account || pending.length === 0) return null;
      const order: Order = {
        id: `#PD-${Date.now().toString().slice(-6)}`,
        accountId,
        tableId: account.tableId,
        customer: account.label,
        items: pending.map((i) => ({
          productId: i.productId,
          name: i.name,
          qty: i.qty,
          modifiers: i.modifiers.map((m) => m.name),
        })),
        amount: round2(pending.reduce((s, i) => s + itemLineTotal(i), 0)),
        time: new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
        elapsed: "ahora mismo",
        createdAt: nowIso(),
        status: "pendiente",
        channel: account.tableId ? "Mesa" : "Llevar",
        waiter: account.waiter,
      };
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === accountId
            ? { ...a, items: a.items.map((i) => (i.sent ? i : { ...i, sent: true })) }
            : a,
        ),
      );
      setState((s) => ({
        ...s,
        scopes: {
          ...s.scopes,
          [account.branchId]: {
            ...s.scopes[account.branchId],
            orders: [order, ...(s.scopes[account.branchId]?.orders ?? [])],
          },
        },
      }));
      return order;
    },
    [accounts, setAccounts],
  );

  /**
   * Crea la comanda en la API con las líneas pendientes de la cuenta.
   * El servidor resuelve precio, folio y mesero (AYCDS-20): aquí solo viajan
   * `platoId`, `cantidad` y `notas`.
   */
  const createOrderFromAccount = useCallback(
    async (accountId: string): Promise<Order | null> => {
      const account = accounts.find((a) => a.id === accountId);
      if (!account) return null;
      const items = orderItemsFromAccount(account);
      if (items.length === 0) return null;

      const created = await ordersApi.createOrder({
        ...(account.tableApiId ? { mesaId: account.tableApiId } : {}),
        origen: account.tableApiId ? "MESA" : "BARRA",
        items,
      });

      // La línea queda enviada solo si el servidor aceptó la comanda.
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === accountId
            ? {
                ...a,
                orderApiIds: [...(a.orderApiIds ?? []), created.id],
                items: a.items.map((i) => (i.sent ? i : { ...i, sent: true })),
              }
            : a,
        ),
      );
      await refreshOrders();
      return orderFromApi(created, { nameOf: platoNameOf });
    },
    [accounts, platoNameOf, refreshOrders, setAccounts],
  );

  /** Con sesión real manda la comanda a la API; sin sesión queda el modo demo. */
  const sendToKitchen = useCallback(
    async (accountId: string): Promise<Order | null> => {
      if (!currentUser?.empresaId) return localSendToKitchen(accountId);
      try {
        return await createOrderFromAccount(accountId);
      } catch (error) {
        setOrdersError(
          error instanceof ApiError ? error.message : "No se pudo enviar la comanda.",
        );
        throw error;
      }
    },
    [createOrderFromAccount, currentUser, localSendToKitchen],
  );

  /**
   * Avanza una comanda: `PATCH /orders/:id/status` cuando es una orden real y
   * cambio local en el modo demo. Devuelve `false` si la API lo rechaza
   * (p. ej. anular una comanda que ya está en cocina).
   */
  const advanceOrder = useCallback(
    async (order: Order, next: OrderStatus): Promise<boolean> => {
      const apiStatus = UI_TO_API_STATUS[next];
      if (order.apiId && currentUser?.empresaId) {
        if (!apiStatus) return false;
        try {
          await ordersApi.updateOrderStatus(order.apiId, apiStatus);
          await refreshOrders();
          return true;
        } catch (error) {
          setOrdersError(
            error instanceof ApiError ? error.message : "No se pudo actualizar la comanda.",
          );
          return false;
        }
      }
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
      return true;
    },
    [currentUser, refreshOrders, setOrders],
  );

  const transitionOrderToTerminal = useCallback(
    async (orderId: string, target: "PAGADA" | "CERRADA" | "ANULADA") => {
      try {
        const order = await ordersApi.getOrder(orderId);
        let currentStatus = order.estado;

        if (TERMINAL_API_STATES.includes(currentStatus)) {
          return;
        }

        if (target === "ANULADA") {
          if (currentStatus === "POR_CONFIRMAR") {
            await ordersApi.updateOrderStatus(orderId, "ANULADA");
            return;
          }
          target = "CERRADA";
        }

        if (currentStatus === "POR_CONFIRMAR") {
          await ordersApi.updateOrderStatus(orderId, "EN_COCINA");
          currentStatus = "EN_COCINA";
        }
        if (currentStatus === "EN_COCINA") {
          await ordersApi.updateOrderStatus(orderId, "LISTO");
          currentStatus = "LISTO";
        }
        if (currentStatus === "LISTO") {
          await ordersApi.updateOrderStatus(orderId, "ENTREGADO");
          currentStatus = "ENTREGADO";
        }
        if (currentStatus === "ENTREGADO") {
          await ordersApi.updateOrderStatus(orderId, target);
        }
      } catch (err) {
        console.error(`Error al pasar orden ${orderId} a ${target}:`, err);
      }
    },
    [],
  );

  const closeAccountOrders = useCallback(
    async (account: TableAccount, target: "PAGADA" | "CERRADA" | "ANULADA") => {
      if (!currentUser?.empresaId) return;

      const orderIdsToClose = new Set<string>(account.orderApiIds ?? []);

      if (liveOrders) {
        for (const ord of liveOrders) {
          if (ord.apiId) {
            const matchesAccount = account.orderApiIds?.includes(ord.apiId) || ord.accountId === account.id;
            const matchesTable =
              (account.tableApiId && ord.mesaApiId === account.tableApiId) ||
              (account.tableId != null && ord.tableId === account.tableId);
            if (matchesAccount || matchesTable) {
              orderIdsToClose.add(ord.apiId);
            }
          }
        }
      }

      if (account.tableApiId) {
        try {
          const list = await ordersApi.listOrders({ mesaId: account.tableApiId });
          for (const it of list.items) {
            if (!TERMINAL_API_STATES.includes(it.estado)) {
              orderIdsToClose.add(it.id);
            }
          }
        } catch (err) {
          console.error("Error al consultar órdenes de mesa:", err);
        }
      }

      for (const orderId of orderIdsToClose) {
        await transitionOrderToTerminal(orderId, target);
      }

      await refreshOrders();
    },
    [currentUser?.empresaId, liveOrders, refreshOrders, transitionOrderToTerminal],
  );

  const annulAccount = useCallback(
    (accountId: string, motivo: string) => {
      const account = accounts.find((a) => a.id === accountId);
      if (!account) return;

      setAccounts((prev) =>
        prev.map((a) =>
          a.id === accountId
            ? { ...a, status: "anulada", closedAt: nowIso(), motivoAnulacion: motivo }
            : a,
        ),
      );
      if (account.tableId) {
        setState((s) => ({
          ...s,
          scopes: patchTableStatus(s.scopes, account.branchId, account.tableId!, "libre"),
        }));
      }

      void closeAccountOrders(account, "ANULADA");
    },
    [accounts, closeAccountOrders, setAccounts],
  );

  /* ---------- Facturación electrónica SUNAT ---------- */

  const toggleSunatContingencia = useCallback(() => {
    setState((s) => ({ ...s, sunatContingencia: !s.sunatContingencia }));
  }, []);

  /** Envía un CPE al OSE: nunca bloquea la venta (cola + reintentos). */
  const enviarSunat = useCallback(
    (receipt: Receipt) => {
      const port = getFacturacionPort();
      port.setContingencia(state.sunatContingencia);
      setState((s) => ({
        ...s,
        receipts: s.receipts.map((r) =>
          r.id === receipt.id
            ? {
                ...r,
                estadoSunat: "enviado" as const,
                intentosEnvio: r.intentosEnvio + 1,
                ultimoEnvio: nowIso(),
              }
            : r,
        ),
      }));
      void port.enviar(cpeFromReceipt(receipt)).then((res) => {
        setState((s) => ({
          ...s,
          receipts: s.receipts.map((r) =>
            r.id === receipt.id
              ? {
                  ...r,
                  estadoSunat: res.estado,
                  cdr: res.cdr ?? r.cdr,
                  mensajeSunat: res.mensaje,
                }
              : r,
          ),
        }));
      });
    },
    [state.sunatContingencia],
  );

  /** Resumen diario: da de baja las boletas anuladas pendientes. */
  const generarResumenDiario = useCallback((): {
    count: number;
    resumenId: string;
  } | null => {
    const pendientes = state.receipts.filter(
      (r) => r.type === "03" && r.status === "Anulada" && r.bajaResumenId === "RC-pendiente",
    );
    if (pendientes.length === 0) return null;
    const at = nowIso();
    const dayKey = at.slice(0, 10).replace(/-/g, "");
    const seq =
      state.receipts.filter((r) => (r.bajaResumenId ?? "").startsWith(`RC-${dayKey}-`)).length + 1;
    const resumenId = `RC-${dayKey}-${String(seq).padStart(2, "0")}`;
    const port = getFacturacionPort();
    port.setContingencia(state.sunatContingencia);
    void port.enviarBaja(pendientes.map((r) => r.id)).then((res) => {
      if (res.estado !== "aceptado") return;
      setState((s) => ({
        ...s,
        receipts: s.receipts.map((r) =>
          pendientes.some((p) => p.id === r.id) ? { ...r, bajaResumenId: resumenId } : r,
        ),
      }));
    });
    return { count: pendientes.length, resumenId };
  }, [state.receipts, state.sunatContingencia]);

  const checkoutAccount = useCallback(
    (input: CheckoutInput): Receipt | null => {
      const account = accounts.find((a) => a.id === input.accountId);
      if (!account || account.status !== "abierta") return null;
      const base = accountTotals(account);
      const coupon = input.couponCode
        ? state.coupons.find((c) => c.code === input.couponCode) ?? null
        : null;
      const discount = coupon ? parseCouponDiscount(coupon, base.subtotal) : 0;
      const total = round2(base.subtotal - discount);
      const { subtotal, igv } = splitIgv(total);
      const at = nowIso();
      const receiptId = nextReceiptNumber(state.receipts, input.receiptType);

      const receipt: Receipt = {
        id: receiptId,
        type: input.receiptType,
        at,
        date: fmtDateTime(at),
        customer: account.customer || account.label,
        docType: input.docType,
        docNumber: input.docNumber,
        subtotal,
        igv,
        total,
        status: "Pagada",
        source: `Cuenta ${account.id} · ${account.label}`,
        accountId: account.id,
        estadoSunat: "en_cola",
        intentosEnvio: 0,
      };

      const payments: Payment[] = input.payments.map((p) => ({
        method: p.method,
        amount: round2(p.amount),
        tip: 0,
        at,
      }));

      const movements: CashMovement[] = input.payments.map((p, i) => ({
        id: Date.now() + i,
        at,
        datetime: fmtDateTime(at),
        concept: `Cobro ${account.label} · ${account.id}`,
        kind: "Ingreso",
        amount: round2(p.amount),
        method: p.method,
        shiftId: openCashShift?.id,
        accountId: account.id,
      }));

      if (input.customerId) addPoints(input.customerId, Math.floor(total));

      setAccounts((prev) =>
        prev.map((a) =>
          a.id === account.id
            ? {
                ...a,
                status: "cobrada",
                closedAt: at,
                payments,
                tip: round2(input.tip),
                discount,
                discountConcept: coupon ? `Cupón ${coupon.code}` : "",
                couponCode: coupon?.code ?? null,
                customerId: input.customerId,
              }
            : a,
        ),
      );
      setState((s) => {
        const scopes = account.tableId
          ? patchTableStatus(s.scopes, account.branchId, account.tableId, "libre")
          : s.scopes;
        return {
          ...s,
          receipts: [receipt, ...s.receipts],
          coupons: coupon
            ? s.coupons.map((c) => (c.code === coupon.code ? { ...c, used: c.used + 1 } : c))
            : s.coupons,
          scopes: {
            ...scopes,
            [account.branchId]: {
              ...scopes[account.branchId],
              cash: [...movements, ...(scopes[account.branchId]?.cash ?? [])],
            },
          },
        };
      });
      enviarSunat(receipt);
      void closeAccountOrders(account, "PAGADA");
      return receipt;
    },
    [
      accounts,
      state.coupons,
      state.receipts,
      openCashShift,
      enviarSunat,
      closeAccountOrders,
      addPoints,
      setAccounts,
    ],
  );

  /** Anulación tributaria: NC si es factura, baja en resumen si es boleta. */
  const annulReceipt = useCallback(
    (id: string, motivo: string) => {
      const receipt = state.receipts.find((r) => r.id === id);
      if (!receipt || receipt.status === "Anulada") return;
      const at = nowIso();
      const account = receipt.accountId
        ? accounts.find((a) => a.id === receipt.accountId)
        : undefined;
      const methods: { method: string; amount: number }[] = account?.payments.length
        ? account.payments.map((p) => ({ method: p.method, amount: p.amount }))
        : [{ method: "Efectivo", amount: receipt.total }];
      const reverse: CashMovement[] = methods.map((m, i) => ({
        id: Date.now() + i,
        at,
        datetime: fmtDateTime(at),
        concept: `Anulación ${receipt.id}`,
        kind: "Egreso",
        amount: m.amount,
        method: m.method,
        accountId: receipt.accountId,
      }));
      const branchId = account?.branchId ?? branchIds[0];
      const nota: Receipt | null =
        receipt.type === "01"
          ? {
              id: nextReceiptNumber(state.receipts, "07"),
              type: "07",
              at,
              date: fmtDateTime(at),
              customer: receipt.customer,
              docType: receipt.docType,
              docNumber: receipt.docNumber,
              subtotal: receipt.subtotal,
              igv: receipt.igv,
              total: receipt.total,
              status: "Emitida",
              source: `Nota de crédito · ${receipt.id}`,
              accountId: receipt.accountId,
              refId: receipt.id,
              motivoAnulacion: motivo,
              estadoSunat: "en_cola",
              intentosEnvio: 0,
            }
          : null;
      const patch = (r: Receipt): Receipt =>
        r.id === id
          ? {
              ...r,
              status: "Anulada",
              motivoAnulacion: motivo,
              estadoSunat: "anulado",
              ...(r.type === "03" ? { bajaResumenId: r.bajaResumenId ?? "RC-pendiente" } : {}),
            }
          : r;
      setState((s) => ({
        ...s,
        receipts: nota ? [nota, ...s.receipts.map(patch)] : s.receipts.map(patch),
        scopes: {
          ...s.scopes,
          [branchId]: {
            ...s.scopes[branchId],
            cash: [...reverse, ...(s.scopes[branchId]?.cash ?? [])],
          },
        },
      }));
      if (nota) enviarSunat(nota);
    },
    [accounts, state.receipts, enviarSunat, branchIds],
  );

  /* ---------- Turno de caja ---------- */

  const startCashShift = useCallback(
    (fund: number) => {
      if (openCashShift) return;
      const at = nowIso();
      const shift: CashShift = {
        id: newId("CH"),
        branchId: writeBranchId,
        status: "abierto",
        openedBy: currentUser?.name ?? "Caja",
        openedAt: at,
        openingFund: round2(fund),
        closedBy: null,
        closedAt: null,
        countedCash: null,
        expectedCash: null,
        difference: null,
        observations: "",
      };
      const movement: CashMovement = {
        id: Date.now(),
        at,
        datetime: fmtDateTime(at),
        concept: "Fondo de apertura",
        kind: "Ingreso",
        amount: round2(fund),
        method: "Efectivo",
        shiftId: shift.id,
      };
      setState((s) => ({
        ...s,
        cashShifts: [shift, ...s.cashShifts],
        scopes: {
          ...s.scopes,
          [writeBranchId]: {
            ...s.scopes[writeBranchId],
            cash: [movement, ...(s.scopes[writeBranchId]?.cash ?? [])],
          },
        },
      }));
    },
    [openCashShift, writeBranchId, currentUser],
  );

  const closeCashShift = useCallback(
    (countedCash: number, observations: string) => {
      const shift = openCashShift;
      if (!shift) return;
      const movements = state.scopes[shift.branchId]?.cash ?? [];
      const expected = expectedCashFor(shift, movements);
      setState((s) => ({
        ...s,
        cashShifts: s.cashShifts.map((sh) =>
          sh.id === shift.id
            ? {
                ...sh,
                status: "cerrado",
                closedBy: currentUser?.name ?? "Caja",
                closedAt: nowIso(),
                countedCash: round2(countedCash),
                expectedCash: expected,
                difference: round2(countedCash - expected),
                observations,
              }
            : sh,
        ),
      }));
    },
    [openCashShift, state.scopes, currentUser],
  );

  const value = useMemo<ModulesContext>(
    () => ({
      payments,
      tickets: state.tickets,
      addTicket,
      setTickets,
      products,
      categories,
      modifierGroups,
      priceLists,
      catalogLoading,
      catalogError,
      refreshCatalog,
      saveProduct,
      setProductActive,
      saveCategory,
      deleteCategory,
      createModifierGroup,
      updateModifierGroup,
      deleteModifierGroup,
      createPriceList,
      activatePriceList,
      setPrice,
      priceOf,
      categoryNameOf,
      company,
      tenant,
      branches,
      activeBranch,
      activeBranchId,
      isGeneral,
      setActiveBranch,
      branchOf,
      orders: liveOrders ?? activeScope.orders,
      setOrders,
      ordersLoading,
      ordersError,
      refreshOrders,
      createOrderFromAccount,
      advanceOrder,
      tables: liveTables ?? activeScope.tables,
      setTables,
      tablesLoading,
      tablesError,
      refreshTables,
      hasSession,
      roles,
      setRoles,
      reservations: liveReservations ?? state.reservations,
      setReservations,
      reservationsLoading,
      reservationsError,
      refreshReservations,
      ingredients,
      setIngredients,
      movements,
      setMovements,
      customers,
      setCustomers,
      coupons: state.coupons,
      setCoupons,
      cashMovements: activeScope.cash,
      setCashMovements,
      receipts: state.receipts,
      setReceipts,
      annulReceipt,
      enviarSunat,
      generarResumenDiario,
      sunatContingencia: state.sunatContingencia,
      toggleSunatContingencia,
      expenses,
      setExpenses,
      combos: state.combos,
      setCombos,
      accounts: activeAccounts,
      openAccount,
      addAccountItems,
      updateAccountItem,
      removeAccountItem,
      sendToKitchen,
      annulAccount,
      checkoutAccount,
      cashShifts,
      openCashShift,
      startCashShift,
      closeCashShift,
      notifications,
      hasUnread,
      notify,
      clearUnread,
      resetDemoData,
      currentUser,
      login,
      logout,
    }),
    [
      payments,
      state,
      customers,
      expenses,
      ingredients,
      movements,
      roles,
      addTicket,
      setTickets,
      products,
      categories,
      modifierGroups,
      priceLists,
      catalogLoading,
      catalogError,
      refreshCatalog,
      saveProduct,
      setProductActive,
      saveCategory,
      deleteCategory,
      createModifierGroup,
      updateModifierGroup,
      deleteModifierGroup,
      createPriceList,
      activatePriceList,
      setPrice,
      priceOf,
      categoryNameOf,
      company,
      tenant,
      branches,
      activeBranch,
      activeBranchId,
      isGeneral,
      setActiveBranch,
      branchOf,
      activeScope,
      liveOrders,
      liveTables,
      liveReservations,
      ordersLoading,
      ordersError,
      refreshOrders,
      setOrders,
      setTables,
      tablesLoading,
      tablesError,
      refreshTables,
      hasSession,
      setRoles,
      setReservations,
      reservationsLoading,
      reservationsError,
      refreshReservations,
      setIngredients,
      setMovements,
      setCustomers,
      setCoupons,
      setCashMovements,
      setReceipts,
      annulReceipt,
      enviarSunat,
      generarResumenDiario,
      toggleSunatContingencia,
      setExpenses,
      setCombos,
      activeAccounts,
      openAccount,
      addAccountItems,
      updateAccountItem,
      removeAccountItem,
      sendToKitchen,
      createOrderFromAccount,
      advanceOrder,
      annulAccount,
      checkoutAccount,
      cashShifts,
      openCashShift,
      startCashShift,
      closeCashShift,
      notifications,
      hasUnread,
      notify,
      clearUnread,
      resetDemoData,
      currentUser,
      login,
      logout,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function scopesOf(scopes: Record<string, BranchScope>, id: string): BranchScope {
  return (
    scopes[id] ?? { orders: [], tables: [], cash: [] }
  );
}

function patchTableStatus(
  scopes: Record<string, BranchScope>,
  branchId: string,
  tableId: number,
  status: Table["status"],
): Record<string, BranchScope> {
  const slug = SEED_BRANCH_SLUGS[branchId];
  const uuid = SEED_SLUG_BRANCH_IDS[branchId];
  const targets = Array.from(new Set([branchId, slug, uuid].filter((x): x is string => Boolean(x))));
  let nextScopes = { ...scopes };
  for (const tid of targets) {
    if (nextScopes[tid]) {
      nextScopes = {
        ...nextScopes,
        [tid]: {
          ...nextScopes[tid],
          tables: (nextScopes[tid]?.tables ?? []).map((t) =>
            t.id === tableId ? { ...t, status } : t,
          ),
        },
      };
    }
  }
  return nextScopes;
}

export function useModules() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useModules debe usarse dentro de ModulesProvider");
  return ctx;
}
