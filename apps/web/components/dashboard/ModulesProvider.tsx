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
  initialCustomers,
  initialExpenses,
  initialIngredients,
  initialMovements,
  initialReceipts,
  initialReservations,
  initialRoles,
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
  ALL_BRANCHES,
  BRANCH_IDS,
  DEMO_COMPANY,
  DEMO_EMPRESA_ID,
  GENERAL_BRANCH,
  SEED_SLUG_BRANCH_IDS,
  demoScopeFor,
  initialAccounts,
  initialCashShifts,
  initialScopes,
  type Branch,
  type BranchScope,
} from "@/lib/tenancy";
import { fetchBranches, fetchTenant, type Tenant } from "@/lib/tenant-api";
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
  categoryName,
  initialCombos,
  priceOf,
  type Combo,
  type ModifierGroup,
  type PriceList,
  type Product,
  type ProductCategory,
} from "@/lib/erp-catalog";
import { ApiError } from "@/lib/api";
import { createSession, logoutUrl } from "@/lib/session-api";
import * as catalogApi from "@/lib/catalog-api";
import * as ordersApi from "@/lib/orders-api";
import { listReservations } from "@/lib/reservations-api";
import { limaTodayKey, reservationsFromApi, tablesFromApi } from "@/lib/table-mapping";
import { listTables } from "@/lib/tables-api";
import { UI_TO_API_STATUS, orderFromApi, orderItemsFromAccount } from "@/lib/order-mapping";
import {
  cpeFromReceipt,
  getFacturacionPort,
} from "@/lib/facturacion";
import {
  ANON_TENANT_KEY,
  loadErpState,
  saveErpState,
  resetErpState,
  subscribeErpSync,
  broadcastErpState,
  type ErpState,
} from "@/lib/persistence";

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

/** Entrada de alta/edición de un plato (el precio va aparte, a la lista). */
export type ProductInput = {
  id?: string;
  name: string;
  description: string;
  categoryId: string;
  image: string;
  status: "Activo" | "Inactivo";
  modifierGroupIds: string[];
  price: number;
};

type ModulesContext = {
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
  refreshCatalog: () => Promise<void>;
  saveProduct: (input: ProductInput) => Promise<void>;
  setProductActive: (id: string, active: boolean) => Promise<void>;
  saveCategory: (input: { id?: string; name: string; position: number }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  createModifierGroup: (input: { name: string; required: boolean; multi: boolean }) => Promise<void>;
  updateModifierGroup: (
    id: string,
    input: {
      name?: string;
      required?: boolean;
      multi?: boolean;
      options?: { name: string; extra: number }[];
    },
  ) => Promise<void>;
  deleteModifierGroup: (id: string) => Promise<void>;
  createPriceList: (name: string, fromListId?: string) => Promise<void>;
  activatePriceList: (id: string) => Promise<void>;
  setPrice: (listId: string, platoId: string, price: number) => Promise<void>;
  priceOf: (productId: string) => number;
  categoryNameOf: (categoryId: string) => string;
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

/** Catálogo de la empresa servido por la API (tarea 63). */
type CatalogState = {
  categories: ProductCategory[];
  products: Product[];
  modifierGroups: ModifierGroup[];
  priceLists: PriceList[];
};

const EMPTY_CATALOG: CatalogState = {
  categories: [],
  products: [],
  modifierGroups: [],
  priceLists: [],
};

/** Siguiente SKU secuencial (PLA-00N) a partir del maestro actual. */
function nextSku(products: Product[]): string {
  const max = products.reduce((acc, p) => {
    const suffix = Number(p.sku.match(/(\d+)\s*$/)?.[1] ?? 0);
    return Number.isFinite(suffix) ? Math.max(acc, suffix) : acc;
  }, 0);
  return `PLA-${String(max + 1).padStart(3, "0")}`;
}

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
    accounts: state.accounts.map((account) => ({ ...account, branchId: remap(account.branchId) })),
    cashShifts: state.cashShifts.map((shift) => ({ ...shift, branchId: remap(shift.branchId) })),
  };
}

/** Estado de arranque de un tenant nuevo: sin mocks compartidos. */
function buildEmptyState(): ErpState {
  return {
    version: 2,
    roles: initialRoles,
    reservations: [],
    ingredients: [],
    movements: [],
    customers: [],
    coupons: [],
    receipts: [],
    expenses: [],
    combos: [],
    tickets: [],
    notifications: [],
    hasUnread: false,
    scopes: {},
    accounts: [],
    cashShifts: [],
    sunatContingencia: false,
  };
}

/** Estado inicial: demo para offline o el tenant demo del seed; vacío para el resto. */
function buildInitialState(empresaId: string | null): ErpState {
  if (empresaId !== null && empresaId !== DEMO_EMPRESA_ID) return buildEmptyState();
  return {
    version: 2,
    roles: initialRoles,
    reservations: initialReservations,
    ingredients: initialIngredients,
    movements: initialMovements,
    customers: initialCustomers,
    coupons: initialCoupons,
    receipts: initialReceipts,
    expenses: initialExpenses,
    combos: initialCombos,
    tickets: initialTickets,
    notifications: [],
    hasUnread: false,
    scopes: initialScopes,
    accounts: initialAccounts,
    cashShifts: initialCashShifts,
    sunatContingencia: false,
  };
}

function branchStorageKey(tenantKey: string): string {
  return `fogoneria:branch:${tenantKey}`;
}

export function ModulesProvider({
  children,
  initialPayments,
}: {
  children: React.ReactNode;
  initialPayments: PlanPayment[];
}) {
  const [payments] = useState<PlanPayment[]>(initialPayments);
  const [state, setState] = useState<ErpState>(() => buildInitialState(null));
  const [activeBranchId, setActiveBranchId] = useState<string>("todas");
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  /** `null` = aún no se consultó la API (modo demo/offline). */
  const [tenantBranches, setTenantBranches] = useState<Branch[] | null>(null);
  const applyingRemote = useRef(false);
  /** Namespace de persistencia: una empresa no comparte estado con otra. */
  const tenantKey = currentUser?.empresaId ?? ANON_TENANT_KEY;

  const branchIds = useMemo(
    () =>
      tenantBranches
        ? tenantBranches.map((branch) => branch.id)
        : currentUser
          ? []
          : BRANCH_IDS,
    [tenantBranches, currentUser],
  );
  const branches = useMemo<Branch[]>(
    () =>
      tenantBranches
        ? [GENERAL_BRANCH, ...tenantBranches]
        : currentUser
          ? [GENERAL_BRANCH]
          : ALL_BRANCHES,
    [tenantBranches, currentUser],
  );
  const company = useMemo(
    () =>
      tenant
        ? { legalName: tenant.legalName, ruc: tenant.ruc }
        : currentUser
          ? { legalName: "—", ruc: "—" }
          : DEMO_COMPANY,
    [tenant, currentUser],
  );

  /* Hidratación del usuario al montar (solo cliente). */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("fogoneria:user");
      const found = raw ? (JSON.parse(raw) as AppUser) : null;
      if (found?.id && found.role) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación de sesión (solo cliente)
        setCurrentUser(found);
      }
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);

  /* Al cambiar de empresa, carga su estado aislado (o arranca demo/vacío). */
  useEffect(() => {
    const saved = loadErpState(tenantKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación por tenant
    setState(saved ?? buildInitialState(currentUser?.empresaId ?? null));
    setActiveBranchId(() => {
      if (currentUser?.branchId) return currentUser.branchId;
      try {
        return localStorage.getItem(branchStorageKey(tenantKey)) ?? "todas";
      } catch {
        return "todas";
      }
    });
  }, [tenantKey, currentUser]);

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

  /* ---------- Catálogo desde la API (tarea 63) ---------- */

  const [catalog, setCatalog] = useState<CatalogState>(EMPTY_CATALOG);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  /** Descarta respuestas que llegan después de una recarga más nueva. */
  const catalogRequest = useRef(0);

  const refreshCatalog = useCallback(async (signal?: AbortSignal) => {
    const requestId = ++catalogRequest.current;
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const snapshot = await catalogApi.fetchCatalog(signal);
      if (requestId !== catalogRequest.current) return;
      setCatalog(snapshot);
      // Los combos del seed apuntan a platos del tenant demo: en un tenant
      // nuevo se descartan para no mostrar "Plato retirado".
      const productIds = new Set(snapshot.products.map((product) => product.id));
      setState((prev) => {
        const combos = prev.combos.filter((combo) =>
          combo.productIds.every((productId) => productIds.has(productId)),
        );
        return combos.length === prev.combos.length ? prev : { ...prev, combos };
      });
    } catch (error) {
      if (requestId !== catalogRequest.current || signal?.aborted) return;
      setCatalogError(
        error instanceof ApiError ? error.message : "No se pudo cargar el catálogo.",
      );
    } finally {
      if (requestId === catalogRequest.current) setCatalogLoading(false);
    }
  }, []);

  /* Cargar el catálogo al iniciar sesión y limpiarlo al salir. */
  useEffect(() => {
    if (!currentUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpiar el catálogo al cerrar sesión
      setCatalog(EMPTY_CATALOG);
      return;
    }
    const controller = new AbortController();
    void refreshCatalog(controller.signal);
    return () => controller.abort();
  }, [currentUser, refreshCatalog]);

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
    () => new Map(catalog.products.map((product) => [product.id, product.name])),
    [catalog.products],
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
      } catch (error) {
        if (requestId !== ordersRequest.current || signal?.aborted) return;
        setOrdersError(
          error instanceof ApiError ? error.message : "No se pudieron cargar las comandas.",
        );
      } finally {
        if (requestId === ordersRequest.current) setOrdersLoading(false);
      }
    },
    [activeBranchId, currentUser, platoNameOf],
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

  /* ---------- Mesas y reservas reales de la API (AYCDS-26) ---------- */

  const hasSession = Boolean(currentUser?.empresaId);

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


  /* Empresa y sucursales reales del token (tarea 57). */
  useEffect(() => {
    if (!currentUser) return;
    const controller = new AbortController();

    void (async () => {
      try {
        const [tenantData, branchData] = await Promise.all([
          fetchTenant(controller.signal),
          fetchBranches(controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setTenant(tenantData);
        setTenantBranches(branchData);
        setState((prev) => prepareOps(prev, branchData.map((branch) => branch.id)));
        setActiveBranchId((prev) => {
          const ids = branchData.map((branch) => branch.id);
          if (currentUser.branchId && ids.includes(currentUser.branchId)) return currentUser.branchId;
          if (ids.includes(prev)) return prev;
          return branchData.length > 0 ? branchData[0].id : GENERAL_BRANCH.id;
        });
      } catch {
        // Sin datos reales no se cae a la empresa/sucursales demo: el shell
        // queda sin sucursal operativa hasta que la API responda.
        setTenant(null);
        setTenantBranches([]);
      }
    })();

    return () => controller.abort();
  }, [currentUser]);

  const saveProduct = useCallback(
    async (input: ProductInput) => {
      const payload = {
        name: input.name,
        description: input.description,
        categoryId: input.categoryId,
        image: input.image,
        status: input.status,
        modifierGroupIds: input.modifierGroupIds,
      };
      const isNew = !input.id;
      const id = input.id ?? (await catalogApi.createDish({ ...payload, sku: nextSku(catalog.products) }));
      try {
        if (input.id) await catalogApi.updateDish(input.id, payload);

        const activeList = catalog.priceLists.find((l) => l.active);
        if (activeList) {
          await catalogApi.setPrices(activeList.id, [{ platoId: id, precio: input.price }]);
        }
      } catch (error) {
        // El plato y su precio son dos llamadas: si falla la segunda, se
        // deshace el alta para no dejar platos sin precio.
        if (isNew) {
          try {
            await catalogApi.deleteDish(id);
          } catch {
            /* la limpieza es best-effort */
          }
        }
        throw error;
      }
      await refreshCatalog();
    },
    [catalog.products, catalog.priceLists, refreshCatalog],
  );

  const setProductActive = useCallback(
    async (id: string, active: boolean) => {
      await catalogApi.setDishActive(id, active);
      await refreshCatalog();
    },
    [refreshCatalog],
  );

  const saveCategory = useCallback(
    async (input: { id?: string; name: string; position: number }) => {
      if (input.id) await catalogApi.updateCategory(input.id, { name: input.name, position: input.position });
      else await catalogApi.createCategory({ name: input.name, position: input.position });
      await refreshCatalog();
    },
    [refreshCatalog],
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      await catalogApi.deactivateCategory(id);
      await refreshCatalog();
    },
    [refreshCatalog],
  );

  const createModifierGroup = useCallback(
    async (input: { name: string; required: boolean; multi: boolean }) => {
      await catalogApi.createModifierGroup(input);
      await refreshCatalog();
    },
    [refreshCatalog],
  );

  const updateModifierGroup = useCallback(
    async (
      id: string,
      input: {
        name?: string;
        required?: boolean;
        multi?: boolean;
        options?: { name: string; extra: number }[];
      },
    ) => {
      await catalogApi.updateModifierGroup(id, input);
      await refreshCatalog();
    },
    [refreshCatalog],
  );

  const deleteModifierGroup = useCallback(
    async (id: string) => {
      await catalogApi.deactivateModifierGroup(id);
      await refreshCatalog();
    },
    [refreshCatalog],
  );

  const createPriceList = useCallback(
    async (name: string, fromListId?: string) => {
      const id = await catalogApi.createPriceList(name);
      const source = fromListId ? catalog.priceLists.find((l) => l.id === fromListId) : undefined;
      try {
        if (source) {
          const items = Object.entries(source.prices).map(([platoId, precio]) => ({ platoId, precio }));
          await catalogApi.setPrices(id, items);
        }
      } catch (error) {
        // Copiar precios es una segunda llamada: si falla, se desactiva la lista
        // recién creada para no dejar una lista vacía activa por error.
        try {
          await catalogApi.deletePriceList(id);
        } catch {
          /* la limpieza es best-effort */
        }
        throw error;
      }
      await refreshCatalog();
    },
    [catalog.priceLists, refreshCatalog],
  );

  const activatePriceList = useCallback(
    async (id: string) => {
      await catalogApi.activatePriceList(id);
      await refreshCatalog();
    },
    [refreshCatalog],
  );

  const setPrice = useCallback(
    async (listId: string, platoId: string, price: number) => {
      await catalogApi.setPrices(listId, [{ platoId, precio: price }]);
      await refreshCatalog();
    },
    [refreshCatalog],
  );

  /* ---------- Sesión (JWT) ---------- */

  const login = useCallback(async (email: string, password: string): Promise<AppUser> => {
    const { user } = await createSession(email, password);
    // Un login nuevo no hereda la sucursal del usuario anterior.
    setActiveBranchId("todas");
    setTenant(null);
    setTenantBranches(null);
    setCurrentUser(user);
    try {
      localStorage.setItem("fogoneria:user", JSON.stringify(user));
    } catch {
      /* almacenamiento no disponible */
    }
    if (user.branchId) setActiveBranchId(user.branchId);
    return user;
  }, []);

  const logout = useCallback(() => {
    // Limpia el estado del tenant actual y luego navega al logout del servidor,
    // que borra las cookies HttpOnly y redirige. Si la navegación falla, no se
    // simula un logout exitoso.
    try {
      resetErpState(tenantKey);
      localStorage.removeItem("fogoneria:user");
      localStorage.removeItem(branchStorageKey(tenantKey));
      document.cookie = "fogoneria.role=; path=/; max-age=0";
      document.cookie = "fogoneria.branch=; path=/; max-age=0";
    } catch {
      /* almacenamiento no disponible */
    }
    window.location.assign(logoutUrl());
  }, [tenantKey]);

  const isGeneral = activeBranchId === GENERAL_BRANCH.id;
  const writeBranchId = isGeneral ? branchIds[0] : activeBranchId;

  const activeScope: BranchScope = useMemo(() => {
    if (!isGeneral) return scopesOf(state.scopes, activeBranchId);
    return {
      orders: branchIds.flatMap((id) => state.scopes[id]?.orders ?? []),
      tables: branchIds.flatMap((id) => state.scopes[id]?.tables ?? []),
      cash: branchIds.flatMap((id) => state.scopes[id]?.cash ?? []),
    };
  }, [state.scopes, activeBranchId, isGeneral, branchIds]);

  const accounts = useMemo(
    () => (isGeneral ? state.accounts : state.accounts.filter((a) => a.branchId === activeBranchId)),
    [state.accounts, activeBranchId, isGeneral],
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

  const setRoles = useCallback((r: Role[]) => setPlain("roles", r), [setPlain]);
  const setReservations = useCallback((r: Reservation[]) => setPlain("reservations", r), [setPlain]);
  const setIngredients = useCallback((i: Ingredient[]) => setPlain("ingredients", i), [setPlain]);
  const setMovements = useCallback((m: StockMovement[]) => setPlain("movements", m), [setPlain]);
  const setCustomers = useCallback((c: Customer[]) => setPlain("customers", c), [setPlain]);
  const setCoupons = useCallback((c: Coupon[]) => setPlain("coupons", c), [setPlain]);
  const setReceipts = useCallback((r: Receipt[]) => setPlain("receipts", r), [setPlain]);
  const setExpenses = useCallback((e: Expense[]) => setPlain("expenses", e), [setPlain]);
  const setCombos = useCallback((c: Combo[]) => setPlain("combos", c), [setPlain]);
  const setTickets = useCallback((t: Ticket[]) => setPlain("tickets", t), [setPlain]);

  const priceOfCallback = useCallback(
    (productId: string) => priceOf(productId, catalog.priceLists),
    [catalog.priceLists],
  );

  const categoryNameOf = useCallback(
    (categoryId: string) => categoryName(categoryId, catalog.categories),
    [catalog.categories],
  );

  const notify = useCallback((title: string, message: string) => {
    setState((s) => ({
      ...s,
      notifications: [{ id: Date.now(), title, message, timestamp: Date.now() }, ...s.notifications],
      hasUnread: true,
    }));
  }, []);

  const clearUnread = useCallback(() => {
    setState((s) => ({ ...s, hasUnread: false }));
  }, []);

  const addTicket = useCallback((subject: string) => {
    setState((s) => {
      const ticket: Ticket = {
        id: `#TK-${Math.floor(Math.random() * 9000) + 1000}`,
        subject,
        status: "Enviado",
        updated: "Justo ahora",
      };
      return {
        ...s,
        tickets: [ticket, ...s.tickets],
        notifications: [
          {
            id: Date.now(),
            title: "Ticket enviado",
            message: `Tu solicitud "${subject}" ha sido enviada a soporte.`,
            timestamp: Date.now(),
          },
          ...s.notifications,
        ],
        hasUnread: true,
      };
    });
  }, []);

  const resetDemoData = useCallback(() => {
    resetErpState(tenantKey);
    setState(buildInitialState(currentUser?.empresaId ?? null));
    void refreshCatalog();
  }, [currentUser, refreshCatalog, tenantKey]);

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
      setState((s) => {
        const scopes = input.tableId
          ? patchTableStatus(s.scopes, writeBranchId, input.tableId, "ocupada")
          : s.scopes;
        return { ...s, accounts: [account, ...s.accounts], scopes };
      });
      return id;
    },
    [writeBranchId],
  );

  const patchAccount = useCallback((accountId: string, fn: (a: TableAccount) => TableAccount) => {
    setState((s) => ({
      ...s,
      accounts: s.accounts.map((a) => (a.id === accountId ? fn(a) : a)),
    }));
  }, []);

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
      const account = state.accounts.find((a) => a.id === accountId);
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
      setState((s) => ({
        ...s,
        accounts: s.accounts.map((a) =>
          a.id === accountId
            ? { ...a, items: a.items.map((i) => (i.sent ? i : { ...i, sent: true })) }
            : a,
        ),
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
    [state.accounts],
  );

  /**
   * Crea la comanda en la API con las líneas pendientes de la cuenta.
   * El servidor resuelve precio, folio y mesero (AYCDS-20): aquí solo viajan
   * `platoId`, `cantidad` y `notas`.
   */
  const createOrderFromAccount = useCallback(
    async (accountId: string): Promise<Order | null> => {
      const account = state.accounts.find((a) => a.id === accountId);
      if (!account) return null;
      const items = orderItemsFromAccount(account);
      if (items.length === 0) return null;

      const created = await ordersApi.createOrder({
        ...(account.tableApiId ? { mesaId: account.tableApiId } : {}),
        origen: account.tableApiId ? "MESA" : "BARRA",
        items,
      });

      // La línea queda enviada solo si el servidor aceptó la comanda.
      setState((s) => ({
        ...s,
        accounts: s.accounts.map((a) =>
          a.id === accountId
            ? { ...a, items: a.items.map((i) => (i.sent ? i : { ...i, sent: true })) }
            : a,
        ),
      }));
      await refreshOrders();
      return orderFromApi(created, { nameOf: platoNameOf });
    },
    [platoNameOf, refreshOrders, state.accounts],
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

  const annulAccount = useCallback(
    (accountId: string, motivo: string) => {
      setState((s) => {
        const account = s.accounts.find((a) => a.id === accountId);
        if (!account) return s;
        const scopes = account.tableId
          ? patchTableStatus(s.scopes, account.branchId, account.tableId, "libre")
          : s.scopes;
        return {
          ...s,
          accounts: s.accounts.map((a) =>
            a.id === accountId
              ? { ...a, status: "anulada", closedAt: nowIso(), motivoAnulacion: motivo }
              : a,
          ),
          scopes,
        };
      });
    },
    [],
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
      const account = state.accounts.find((a) => a.id === input.accountId);
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

      setState((s) => {
        const scopes = account.tableId
          ? patchTableStatus(s.scopes, account.branchId, account.tableId, "libre")
          : s.scopes;
        return {
          ...s,
          receipts: [receipt, ...s.receipts],
          accounts: s.accounts.map((a) =>
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
          coupons: coupon
            ? s.coupons.map((c) => (c.code === coupon.code ? { ...c, used: c.used + 1 } : c))
            : s.coupons,
          customers: input.customerId
            ? s.customers.map((c) =>
                c.id === input.customerId
                  ? {
                      ...c,
                      points: c.points + Math.floor(total),
                      visits: c.visits + 1,
                      lastVisit: "Hoy",
                    }
                  : c,
              )
            : s.customers,
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
      return receipt;
    },
    [state.accounts, state.coupons, state.receipts, openCashShift, enviarSunat],
  );

  /** Anulación tributaria: NC si es factura, baja en resumen si es boleta. */
  const annulReceipt = useCallback(
    (id: string, motivo: string) => {
      const receipt = state.receipts.find((r) => r.id === id);
      if (!receipt || receipt.status === "Anulada") return;
      const at = nowIso();
      const account = receipt.accountId
        ? state.accounts.find((a) => a.id === receipt.accountId)
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
    [state.receipts, state.accounts, enviarSunat, branchIds],
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
      products: catalog.products,
      categories: catalog.categories,
      modifierGroups: catalog.modifierGroups,
      priceLists: catalog.priceLists,
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
      priceOf: priceOfCallback,
      categoryNameOf,
      company,
      tenant,
      branches,
      activeBranch: branches.find((b) => b.id === activeBranchId) ?? branches[0],
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
      roles: state.roles,
      setRoles,
      reservations: liveReservations ?? state.reservations,
      setReservations,
      reservationsLoading,
      reservationsError,
      refreshReservations,
      ingredients: state.ingredients,
      setIngredients,
      movements: state.movements,
      setMovements,
      customers: state.customers,
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
      expenses: state.expenses,
      setExpenses,
      combos: state.combos,
      setCombos,
      accounts,
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
      notifications: state.notifications,
      hasUnread: state.hasUnread,
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
      addTicket,
      setTickets,
      catalog,
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
      priceOfCallback,
      categoryNameOf,
      company,
      tenant,
      branches,
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
      accounts,
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
  return {
    ...scopes,
    [branchId]: {
      ...scopes[branchId],
      tables: (scopes[branchId]?.tables ?? []).map((t) =>
        t.id === tableId ? { ...t, status } : t,
      ),
    },
  };
}

export function useModules() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useModules debe usarse dentro de ModulesProvider");
  return ctx;
}
