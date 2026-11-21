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
  type Notification,
  type Payment as PlanPayment,
  type Ticket,
} from "@/lib/dashboard";
import {
  type CashMovement,
  type Coupon,
  type Customer,
  type Expense,
  type Ingredient,
  type Order,
  type OrderStatus,
  type Receipt,
  type Reservation,
  type Role,
  type StockMovement,
  type Table,
} from "@/lib/erp";
import {
  GENERAL_BRANCH,
  SEED_SLUG_BRANCH_IDS,
  type Branch,
  type BranchScope,
} from "@/lib/tenancy";
import type { Tenant } from "@/lib/tenant-api";
import type { AppUser } from "@/lib/auth";
import {
  fmtDateTime,
  itemLineTotal,
  newId,
  nextReceiptNumber,
  nowIso,
  round2,
  type AccountItem,
  type CashShift,
  type TableAccount,
} from "@/lib/domain";
import {
  type Combo,
  type ModifierGroup,
  type PriceList,
  type Product,
  type ProductCategory,
} from "@/lib/erp-catalog";import { ApiError } from "@/lib/api";
import {
  migrateLegacyCustomers,
  readCrmCustomers,
  saveCrmCustomers,
  type LegacyErpState,
} from "@/lib/crm-storage";
import {
  migrateLegacyArray,
  migrateLegacyCash,
  migrateLegacyInventory,
  migrateLegacyPromotions,
  migrateLegacyReceipts,
  migrateLegacyScopes,
  readModuleValue,
  saveModuleValue,
  type CashStoreState,
  type InventoryStoreState,
  type LegacyErpState as LegacyModuleState,
  type PromotionsStoreState,
  type ReceiptsStoreState,
} from "@/lib/module-store";
import { tenantKeyOf } from "@/lib/session-state";
import { matchesBranch } from "@/lib/tenant-scope";
import { useCatalogoState } from "./providers/catalog";
import { useCheckout } from "./providers/checkout";
import { useTickets } from "./providers/tickets";
import { useCrm } from "@/features/crm/provider";
import { useCash } from "@/features/cash/provider";
import { useExpenses } from "@/features/expenses/provider";
import { useInventory } from "@/features/inventory/provider";
import { useAccounts, useOrdersDemo } from "@/features/orders/provider";
import { usePromotions } from "@/features/promotions/provider";
import { useReservations } from "@/features/reservations/provider";
import { useReceipts } from "@/features/receipts/provider";
import { useStaff } from "@/features/staff/provider";
import { useTables } from "@/features/tables/provider";
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
import type { CheckoutInput } from "@/lib/checkout";
export type { CheckoutInput } from "@/lib/checkout";
import {
  loadErpState,
  resetErpState,
} from "@/lib/persistence";

const TERMINAL_API_STATES: readonly ordersApi.ApiOrderStatus[] = [
  "PAGADA",
  "CERRADA",
  "ANULADA",
];

/* `CheckoutInput` se reexporta desde `lib/checkout` (F6c2). El tipo de
   catálogo se mantiene exportado desde aquí por compatibilidad. */
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
  branchOf: (kind: keyof BranchScope | "cash", id: number | string) => Branch | null;
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
  const { customers, setCustomers, resetCustomers } = useCrm();
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
  const {
    ordersByBranch,
    setOrdersForBranches,
    setBranchOrders,
    ensureDemoOrders,
    remapBranches: remapOrdersBranches,
    resetOrdersDemo,
  } = useOrdersDemo();
  const {
    tablesByBranch,
    setTablesForBranches,
    patchStatus,
    ensureDemoTables,
    remapBranches: remapTablesBranches,
    resetTables,
  } = useTables();
  const {
    reservations: demoReservations,
    setReservations: setDemoReservations,
    resetReservations,
  } = useReservations();
  const { tickets, setTickets, resetTickets } = useTickets();
  const cash = useCash();
  const {
    cashShifts: allCashShifts,
    activeShift,
    reverseMovements,
    setMovements: setMovementsOf,
    setMovementsByBranch,
    remapBranches: remapCashBranches,
    resetCash,
  } = cash;
  const {
    receipts,
    sunatContingencia,
    addReceipt,
    setReceipts,
    patchReceipt,
    enviarSunat,
    generarResumenDiario,
    toggleSunatContingencia,
    resetReceipts,
  } = useReceipts();
  const {
    combos,
    setCombos,
    coupons,
    setCoupons,
    resetPromotions,
  } = usePromotions();
  const [payments] = useState<PlanPayment[]>(initialPayments);
  /** Namespace de persistencia: una empresa no comparte estado con otra. */
  const tenantKey = tenantKeyOf(currentUser);
  const empresaId = currentUser?.empresaId ?? null;

  /**
   * Migración final del `ErpState` legacy (F6c3). Los providers ya hidrataron
   * sus propias claves; aquí se extraen los slices que quedaban (scopes demo,
   * reservas y tickets) y se borra la clave para no volver a migrar.
   */
  useEffect(() => {
    const saved = loadErpState(tenantKey) as LegacyErpState | null;
    if (!saved) return;

    let next = saved as LegacyModuleState;

    const crm = migrateLegacyCustomers(next as LegacyErpState, readCrmCustomers(tenantKey));
    if (crm.migrated) {
      saveCrmCustomers(tenantKey, crm.migrated);
      next = crm.state as LegacyModuleState;
    }

    const expensesMigration = migrateLegacyArray(
      next,
      "expenses",
      readModuleValue<Expense[]>("expenses", tenantKey),
    );
    if (expensesMigration.migrated) {
      saveModuleValue("expenses", tenantKey, expensesMigration.migrated);
      next = expensesMigration.state as LegacyModuleState;
    }

    const inventoryMigration = migrateLegacyInventory(
      next,
      readModuleValue<InventoryStoreState>("inventory", tenantKey),
    );
    if (inventoryMigration.migrated) {
      saveModuleValue("inventory", tenantKey, inventoryMigration.migrated);
      next = inventoryMigration.state as LegacyModuleState;
    }

    const staffMigration = migrateLegacyArray(
      next,
      "roles",
      readModuleValue<Role[]>("staff", tenantKey),
    );
    if (staffMigration.migrated) {
      saveModuleValue("staff", tenantKey, staffMigration.migrated);
      next = staffMigration.state as LegacyModuleState;
    }

    const accountsMigration = migrateLegacyArray(
      next,
      "accounts",
      readModuleValue<TableAccount[]>("orders", tenantKey),
    );
    if (accountsMigration.migrated) {
      saveModuleValue("orders", tenantKey, accountsMigration.migrated);
      next = accountsMigration.state as LegacyModuleState;
    }

    const cashMigration = migrateLegacyCash(
      next,
      readModuleValue<CashStoreState>("cash", tenantKey),
    );
    if (cashMigration.migrated) {
      saveModuleValue("cash", tenantKey, cashMigration.migrated);
      next = cashMigration.state as LegacyModuleState;
    }

    const receiptsMigration = migrateLegacyReceipts(
      next,
      readModuleValue<ReceiptsStoreState>("receipts", tenantKey),
    );
    if (receiptsMigration.migrated) {
      saveModuleValue("receipts", tenantKey, receiptsMigration.migrated);
      next = receiptsMigration.state as LegacyModuleState;
    }

    const promotionsMigration = migrateLegacyPromotions(
      next,
      readModuleValue<PromotionsStoreState>("promotions", tenantKey),
    );
    if (promotionsMigration.migrated) {
      saveModuleValue("promotions", tenantKey, promotionsMigration.migrated);
      next = promotionsMigration.state as LegacyModuleState;
    }

    const scopesMigration = migrateLegacyScopes(
      next,
      readModuleValue<Record<string, Order[]>>("orders-demo", tenantKey),
      readModuleValue<Record<string, Table[]>>("tables-demo", tenantKey),
    );
    if (scopesMigration.migrated) {
      saveModuleValue("orders-demo", tenantKey, scopesMigration.migrated.ordersByBranch);
      saveModuleValue("tables-demo", tenantKey, scopesMigration.migrated.tablesByBranch);
      next = scopesMigration.state as LegacyModuleState;
    }

    const reservationsMigration = migrateLegacyArray(
      next,
      "reservations",
      readModuleValue<Reservation[]>("reservations", tenantKey),
    );
    if (reservationsMigration.migrated) {
      saveModuleValue("reservations", tenantKey, reservationsMigration.migrated);
      next = reservationsMigration.state as LegacyModuleState;
    }

    const ticketsMigration = migrateLegacyArray(
      next,
      "tickets",
      readModuleValue<Ticket[]>("tickets", tenantKey),
    );
    if (ticketsMigration.migrated) {
      saveModuleValue("tickets", tenantKey, ticketsMigration.migrated);
      next = ticketsMigration.state as LegacyModuleState;
    }

    // Todo migrado: el ErpState legacy ya no es la fuente de nada.
    resetErpState(tenantKey);
  }, [tenantKey]);

  /* Alinea la operación demo con las sucursales reales cuando llegan de la API. */
  const preparedBranches = useRef<string | null>(null);
  useEffect(() => {
    if (!hasSession || tenantLoading || tenantError || !empresaId) return;
    const ids = realBranches.map((branch) => branch.id);
    const signature = `${empresaId}:${ids.join(",")}`;
    if (preparedBranches.current === signature) return;
    preparedBranches.current = signature;
    ensureDemoOrders(ids);
    ensureDemoTables(ids);
  }, [
    ensureDemoOrders,
    ensureDemoTables,
    empresaId,
    hasSession,
    realBranches,
    tenantError,
    tenantLoading,
  ]);

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

  /** Mismo remapeo idempotente para turnos y claves de movimientos de caja. */
  useEffect(() => {
    if (!hasSession || tenantLoading || tenantError || !empresaId) return;
    if (realBranches.length === 0) return;
    remapCashBranches(SEED_SLUG_BRANCH_IDS);
  }, [
    allCashShifts,
    cash.movementsByBranch,
    empresaId,
    hasSession,
    realBranches,
    remapCashBranches,
    tenantError,
    tenantLoading,
  ]);

  /** Remapeo slug→UUID de las claves de comandas y mesas demo (F6c3/H2). */
  useEffect(() => {
    if (!hasSession || tenantLoading || tenantError || !empresaId) return;
    if (realBranches.length === 0) return;
    remapOrdersBranches(SEED_SLUG_BRANCH_IDS);
  }, [
    empresaId,
    hasSession,
    ordersByBranch,
    realBranches,
    remapOrdersBranches,
    tenantError,
    tenantLoading,
  ]);

  useEffect(() => {
    if (!hasSession || tenantLoading || tenantError || !empresaId) return;
    if (realBranches.length === 0) return;
    remapTablesBranches(SEED_SLUG_BRANCH_IDS);
  }, [
    empresaId,
    hasSession,
    realBranches,
    remapTablesBranches,
    tablesByBranch,
    tenantError,
    tenantLoading,
  ]);

  /* Persistencia y sync: las tienen los providers por módulo (F6b/F6c). */

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
    const pruned = combos.filter((combo) =>
      combo.productIds.every((productId) => ids.has(productId)),
    );
    if (pruned.length !== combos.length) setCombos(pruned);
  }, [combos, hasSession, catalogVersion, products, setCombos, tenantKey]);

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
    if (!isGeneral) {
      return {
        orders: ordersByBranch[activeBranchId] ?? [],
        tables: tablesByBranch[activeBranchId] ?? [],
      };
    }
    return {
      orders: branchIds.flatMap((id) => ordersByBranch[id] ?? []),
      tables: branchIds.flatMap((id) => tablesByBranch[id] ?? []),
    };
  }, [ordersByBranch, tablesByBranch, activeBranchId, isGeneral, branchIds]);

  const activeAccounts = useMemo(
    () => (isGeneral ? accounts : accounts.filter((a) => matchesBranch(a.branchId, activeBranchId))),
    [accounts, activeBranchId, isGeneral],
  );

  const cashShifts = useMemo(
    () => (isGeneral ? allCashShifts : allCashShifts.filter((s) => s.branchId === activeBranchId)),
    [allCashShifts, activeBranchId, isGeneral],
  );

  const openCashShift = useMemo(
    () => activeShift(writeBranchId),
    [activeShift, writeBranchId],
  );

  const cashMovements = useMemo(
    () =>
      isGeneral
        ? branchIds.flatMap((id) => cash.movementsByBranch[id] ?? [])
        : cash.movementsByBranch[activeBranchId] ?? [],
    [activeBranchId, branchIds, cash.movementsByBranch, isGeneral],
  );

  const branchOf = useCallback(
    (kind: keyof BranchScope | "cash", id: number | string): Branch | null => {
      if (kind === "cash") {
        for (const b of branches) {
          const list = cash.movementsByBranch[b.id] ?? [];
          if (list.some((m) => m.id === id)) return b;
        }
        return branches.find((b) => b.id !== GENERAL_BRANCH.id) ?? null;
      }
      for (const b of branches) {
        const list =
          kind === "orders"
            ? ordersByBranch[b.id] ?? []
            : tablesByBranch[b.id] ?? [];
        if (list.some((o) => o.id === id)) return b;
      }
      return branches.find((b) => b.id !== GENERAL_BRANCH.id) ?? null;
    },
    [cash.movementsByBranch, ordersByBranch, tablesByBranch, branches],
  );

  /* ---------- Setters (API compatible con las vistas) ---------- */

  const setOrders = useCallback<React.Dispatch<React.SetStateAction<Order[]>>>(
    (v) => setOrdersForBranches(branchIds, activeBranchId, v),
    [activeBranchId, branchIds, setOrdersForBranches],
  );
  const setTables = useCallback<React.Dispatch<React.SetStateAction<Table[]>>>(
    (v) => setTablesForBranches(branchIds, activeBranchId, v),
    [activeBranchId, branchIds, setTablesForBranches],
  );
  const setCashMovements = useCallback<React.Dispatch<React.SetStateAction<CashMovement[]>>>(
    (v) => {
      const applyList = (current: CashMovement[]) =>
        typeof v === "function" ? v(current) : v;
      if (!isGeneral) {
        setMovementsOf(activeBranchId, applyList);
        return;
      }
      // Vista general: se aplica sobre el combinado y se reparte por id.
      setMovementsByBranch((prev) => {
        const combined = branchIds.flatMap((id) => prev[id] ?? []);
        const next = applyList(combined);
        const knownIds = new Set(combined.map((m) => m.id));
        const fresh = next.filter((m) => !knownIds.has(m.id));
        const out = { ...prev };
        branchIds.forEach((id, i) => {
          const own = new Set((prev[id] ?? []).map((m) => m.id));
          const slice = next.filter((m) => own.has(m.id));
          out[id] = i === 0 ? [...slice, ...fresh] : slice;
        });
        return out;
      });
    },
    [activeBranchId, branchIds, isGeneral, setMovementsByBranch, setMovementsOf],
  );
  const setReservations = useCallback(
    (r: Reservation[]) => setDemoReservations(r),
    [setDemoReservations],
  );

  const addTicket = useCallback(
    (subject: string) => {
      const ticket: Ticket = {
        id: `#TK-${Math.floor(Math.random() * 9000) + 1000}`,
        subject,
        status: "Enviado",
        updated: "Justo ahora",
      };
      setTickets((prev) => [ticket, ...prev]);
      notify("Ticket enviado", `Tu solicitud "${subject}" ha sido enviada a soporte.`);
    },
    [notify, setTickets],
  );

  const resetDemoData = useCallback(() => {
    resetErpState(tenantKey);
    sunatEnviados.current.clear();
    resetCustomers();
    resetExpenses();
    resetInventory();
    resetRoles();
    resetAccounts();
    resetCash();
    resetReceipts();
    resetPromotions();
    resetOrdersDemo();
    resetTables();
    resetReservations();
    resetTickets();
    void refreshCatalog();
  }, [
    refreshCatalog,
    resetAccounts,
    resetCash,
    resetCustomers,
    resetExpenses,
    resetInventory,
    resetOrdersDemo,
    resetPromotions,
    resetReceipts,
    resetReservations,
    resetRoles,
    resetTables,
    resetTickets,
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
        patchStatus(writeBranchId, input.tableId, "ocupada");
      }
      return id;
    },
    [patchStatus, setAccounts, writeBranchId],
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
      setBranchOrders(account.branchId, (current) => [order, ...current]);
      return order;
    },
    [accounts, setAccounts, setBranchOrders],
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
        patchStatus(account.branchId, account.tableId, "libre");
      }

      void closeAccountOrders(account, "ANULADA");
    },
    [accounts, closeAccountOrders, patchStatus, setAccounts],
  );

  /* ---------- Cobro (CheckoutCoordinator) y facturación ---------- */

  /**
   * Cobro coordinado (F6c2): `lib/checkout.ts` aplica cuenta → caja →
   * comprobante → cupón → puntos con idempotencia y compensación. Aquí solo se
   * resuelve lo que sigue siendo de `ModulesProvider`: liberar mesa y cerrar
   * las comandas de la API después del commit.
   */
  /** Evita reenviar el mismo CPE si el post-commit se reintenta (M2). */
  const sunatEnviados = useRef(new Set<string>());
  const { checkoutAccount } = useCheckout({
    onCommitted: (receipt, account) => {
      if (account.tableId) {
        patchStatus(account.branchId, account.tableId, "libre");
      }
      if (!sunatEnviados.current.has(receipt.id)) {
        sunatEnviados.current.add(receipt.id);
        enviarSunat(receipt);
      }
      // M2: el cierre de comandas es post-commit y reintentable; si la API
      // agota los reintentos se informa y la venta no se revierte.
      return closeAccountOrders(account, "PAGADA");
    },
    onPostCommitFailed: (_receipt, _account, error) => {
      setOrdersError(
        error instanceof ApiError ? error.message : "No se pudieron cerrar las comandas.",
      );
    },
  });

  /** Anulación tributaria: NC si es factura, baja en resumen si es boleta. */
  const annulReceipt = useCallback(
    (id: string, motivo: string) => {
      const receipt = receipts.find((r) => r.id === id);
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
              id: nextReceiptNumber(receipts, "07"),
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
      patchReceipt(id, {
        status: "Anulada",
        motivoAnulacion: motivo,
        estadoSunat: "anulado",
        ...(receipt.type === "03"
          ? { bajaResumenId: receipt.bajaResumenId ?? "RC-pendiente" }
          : {}),
      });
      if (nota) addReceipt(nota);
      reverseMovements(branchId, reverse);
      if (nota) enviarSunat(nota);
    },
    [
      accounts,
      addReceipt,
      branchIds,
      enviarSunat,
      patchReceipt,
      receipts,
      reverseMovements,
    ],
  );

  /* ---------- Turno de caja (dueño: CashProvider) ---------- */

  const startCashShift = useCallback(
    (fund: number) => {
      cash.startShift({
        branchId: writeBranchId,
        fund,
        openedBy: currentUser?.name ?? "Caja",
      });
    },
    [cash, currentUser, writeBranchId],
  );

  const closeCashShift = useCallback(
    (countedCash: number, observations: string) => {
      cash.closeShift({
        branchId: writeBranchId,
        countedCash,
        observations,
        closedBy: currentUser?.name ?? "Caja",
      });
    },
    [cash, currentUser, writeBranchId],
  );

  const value = useMemo<ModulesContext>(
    () => ({
      payments,
      tickets,
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
      reservations: liveReservations ?? demoReservations,
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
      coupons,
      setCoupons,
      cashMovements,
      setCashMovements,
      receipts,
      setReceipts,
      annulReceipt,
      enviarSunat,
      generarResumenDiario,
      sunatContingencia,
      toggleSunatContingencia,
      expenses,
      setExpenses,
      combos,
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
      customers,
      coupons,
      demoReservations,
      tickets,
      expenses,
      ingredients,
      movements,
      roles,
      cashMovements,
      receipts,
      sunatContingencia,
      combos,
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

export function useModules() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useModules debe usarse dentro de ModulesProvider");
  return ctx;
}
