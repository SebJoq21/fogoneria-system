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
  company,
  initialAccounts,
  initialBranches,
  initialCashShifts,
  initialScopes,
  type Branch,
  type BranchScope,
} from "@/lib/tenancy";
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
import { ApiError, getToken, setToken } from "@/lib/api";
import { createSession, destroySession } from "@/lib/session-api";
import * as catalogApi from "@/lib/catalog-api";
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
  company: typeof company;
  branches: Branch[];
  activeBranch: Branch;
  activeBranchId: string;
  isGeneral: boolean;
  setActiveBranch: (id: string) => void;
  branchOf: (kind: keyof BranchScope, id: number | string) => Branch | null;
  /* Operación por sucursal (órdenes, mesas, caja) */
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  tables: Table[];
  setTables: React.Dispatch<React.SetStateAction<Table[]>>;
  roles: Role[];
  setRoles: (r: Role[]) => void;
  /* Reservas e inventario (persisten al navegar) */
  reservations: Reservation[];
  setReservations: (r: Reservation[]) => void;
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
    label: string;
    customer: string;
    waiter: string;
  }) => string | null;
  addAccountItems: (accountId: string, items: AccountItem[]) => void;
  updateAccountItem: (accountId: string, itemId: string, qty: number) => void;
  removeAccountItem: (accountId: string, itemId: string) => void;
  sendToKitchen: (accountId: string) => Order | null;
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
  logout: () => Promise<void>;
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
  activeId: string,
  key: "orders",
  value: React.SetStateAction<Order[]>,
): Record<string, BranchScope>;
function applyWrite(
  prev: Record<string, BranchScope>,
  activeId: string,
  key: "tables",
  value: React.SetStateAction<Table[]>,
): Record<string, BranchScope>;
function applyWrite(
  prev: Record<string, BranchScope>,
  activeId: string,
  key: "cash",
  value: React.SetStateAction<CashMovement[]>,
): Record<string, BranchScope>;
function applyWrite(
  prev: Record<string, BranchScope>,
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
  const combined = BRANCH_IDS.flatMap((id) => ((prev[id]?.[key] ?? []) as ScopeItem[]));
  const next = typeof asItems === "function" ? asItems(combined) : asItems;
  const knownIds = new Set(combined.map((o) => o.id));
  const fresh = next.filter((o) => !knownIds.has(o.id));
  const out = { ...prev };
  BRANCH_IDS.forEach((id, i) => {
    const own = new Set((((prev[id] as BranchScope | undefined)?.[key] ?? []) as ScopeItem[]).map((o) => o.id));
    const slice = next.filter((o) => own.has(o.id));
    out[id] = { ...out[id], [key]: i === 0 ? [...slice, ...fresh] : slice };
  });
  return out;
}

function buildInitialState(): ErpState {
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

export function ModulesProvider({
  children,
  initialPayments,
}: {
  children: React.ReactNode;
  initialPayments: PlanPayment[];
}) {
  const [payments] = useState<PlanPayment[]>(initialPayments);
  const [state, setState] = useState<ErpState>(buildInitialState);
  const [activeBranchId, setActiveBranchId] = useState<string>("todas");
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const applyingRemote = useRef(false);
  const firstPersist = useRef(true);

  /* Hidratación desde localStorage (solo cliente) */
  useEffect(() => {
    const saved = loadErpState();
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde localStorage (solo cliente)
      setState(saved);
    }
    try {
      const raw = localStorage.getItem("fogoneria:user");
      const found = raw ? (JSON.parse(raw) as AppUser) : null;
      if (found?.id && found.role) {
        setCurrentUser(found);
        if (found.branchId) {
          setActiveBranchId(found.branchId);
        } else {
          const branch = localStorage.getItem("fogoneria:branch");
          if (branch && (branch === "todas" || initialScopes[branch])) {
            setActiveBranchId(branch);
          }
        }
      }
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);

  /* Persistir + difundir a otras pestañas (tras la hidratación inicial) */
  useEffect(() => {
    if (firstPersist.current) {
      firstPersist.current = false;
      return;
    }
    saveErpState(state);
    if (applyingRemote.current) {
      applyingRemote.current = false;
      return;
    }
    broadcastErpState(state);
  }, [state]);

  /* Estado compartido entre pestañas (mesero ↔ cocina) */
  useEffect(() => {
    return subscribeErpSync((msg) => {
      applyingRemote.current = true;
      setState(msg.type === "state" ? msg.state : buildInitialState());
    });
  }, []);

  const setActiveBranch = useCallback((id: string) => {
    if (id !== "todas" && !initialScopes[id]) return;
    setActiveBranchId(id);
    try {
      localStorage.setItem("fogoneria:branch", id);
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);

  /* ---------- Catálogo desde la API (tarea 63) ---------- */

  const [catalog, setCatalog] = useState<CatalogState>(EMPTY_CATALOG);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const refreshCatalog = useCallback(async () => {
    if (!getToken()) {
      setCatalog(EMPTY_CATALOG);
      setCatalogError(null);
      return;
    }
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      setCatalog(await catalogApi.fetchCatalog());
    } catch (error) {
      setCatalogError(
        error instanceof ApiError ? error.message : "No se pudo cargar el catálogo.",
      );
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  /* Cargar el catálogo al iniciar sesión y limpiarlo al salir. */
  useEffect(() => {
    if (currentUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del catálogo tras login
      void refreshCatalog();
    } else {
      setCatalog(EMPTY_CATALOG);
    }
  }, [currentUser, refreshCatalog]);

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
      const id = input.id ?? (await catalogApi.createDish({ ...payload, sku: nextSku(catalog.products) }));
      if (input.id) await catalogApi.updateDish(input.id, payload);

      const activeList = catalog.priceLists.find((l) => l.active);
      if (activeList) {
        await catalogApi.setPrices(activeList.id, [{ platoId: id, precio: input.price }]);
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
      if (source) {
        const items = Object.entries(source.prices).map(([platoId, precio]) => ({ platoId, precio }));
        await catalogApi.setPrices(id, items);
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
    const { user, accessToken } = await createSession(email, password);
    setToken(accessToken);
    setCurrentUser(user);
    try {
      localStorage.setItem("fogoneria:user", JSON.stringify(user));
    } catch {
      /* almacenamiento no disponible */
    }
    if (user.branchId) setActiveBranchId(user.branchId);
    return user;
  }, []);

  const logout = useCallback(async () => {
    setToken(null);
    setCurrentUser(null);
    setCatalog(EMPTY_CATALOG);
    try {
      localStorage.removeItem("fogoneria:user");
      localStorage.removeItem("fogoneria:branch");
      // Limpia cookies planas heredadas de la fase anterior.
      document.cookie = "fogoneria.role=; path=/; max-age=0";
      document.cookie = "fogoneria.branch=; path=/; max-age=0";
    } catch {
      /* almacenamiento no disponible */
    }
    await destroySession();
  }, []);

  const isGeneral = activeBranchId === "todas";
  const writeBranchId = isGeneral ? BRANCH_IDS[0] : activeBranchId;

  const activeScope: BranchScope = useMemo(() => {
    if (!isGeneral) return scopesOf(state.scopes, activeBranchId);
    return {
      orders: BRANCH_IDS.flatMap((id) => state.scopes[id]?.orders ?? []),
      tables: BRANCH_IDS.flatMap((id) => state.scopes[id]?.tables ?? []),
      cash: BRANCH_IDS.flatMap((id) => state.scopes[id]?.cash ?? []),
    };
  }, [state.scopes, activeBranchId, isGeneral]);

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
      for (const b of initialBranches) {
        const list = (state.scopes[b.id]?.[kind] ?? []) as Array<{ id: number | string }>;
        if (list.some((o) => o.id === id)) return b;
      }
      return initialBranches[0] ?? null;
    },
    [state.scopes],
  );

  /* ---------- Setters (API compatible con las vistas) ---------- */

  const setPlain = useCallback(<K extends keyof ErpState>(key: K, value: ErpState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  }, []);

  const setOrders = useCallback<React.Dispatch<React.SetStateAction<Order[]>>>(
    (v) => setState((s) => ({ ...s, scopes: applyWrite(s.scopes, activeBranchId, "orders", v) })),
    [activeBranchId],
  );
  const setTables = useCallback<React.Dispatch<React.SetStateAction<Table[]>>>(
    (v) => setState((s) => ({ ...s, scopes: applyWrite(s.scopes, activeBranchId, "tables", v) })),
    [activeBranchId],
  );
  const setCashMovements = useCallback<React.Dispatch<React.SetStateAction<CashMovement[]>>>(
    (v) => setState((s) => ({ ...s, scopes: applyWrite(s.scopes, activeBranchId, "cash", v) })),
    [activeBranchId],
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
    resetErpState();
    setState(buildInitialState());
    void refreshCatalog();
  }, [refreshCatalog]);

  /* ---------- Cuentas de mesa ---------- */

  const openAccount = useCallback(
    (input: { tableId: number | null; label: string; customer: string; waiter: string }): string | null => {
      const id = newId("CT");
      const account: TableAccount = {
        id,
        branchId: writeBranchId,
        tableId: input.tableId,
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

  const sendToKitchen = useCallback(
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
      const branchId = account?.branchId ?? BRANCH_IDS[0];
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
    [state.receipts, state.accounts, enviarSunat],
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
      branches: ALL_BRANCHES,
      activeBranch: ALL_BRANCHES.find((b) => b.id === activeBranchId) ?? ALL_BRANCHES[0],
      activeBranchId,
      isGeneral,
      setActiveBranch,
      branchOf,
      orders: activeScope.orders,
      setOrders,
      tables: activeScope.tables,
      setTables,
      roles: state.roles,
      setRoles,
      reservations: state.reservations,
      setReservations,
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
      activeBranchId,
      isGeneral,
      setActiveBranch,
      branchOf,
      activeScope,
      setOrders,
      setTables,
      setRoles,
      setReservations,
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
