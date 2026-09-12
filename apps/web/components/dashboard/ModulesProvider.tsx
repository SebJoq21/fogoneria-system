"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  initialMenuData,
  initialTickets,
  type MenuItem,
  type Notification,
  type Payment,
  type Ticket,
} from "@/lib/dashboard";
import {
  initialCoupons,
  initialCustomers,
  initialExpenses,
  initialReceipts,
  initialRoles,
  initialWaTemplates,
  type CashMovement,
  type Coupon,
  type Customer,
  type Expense,
  type Order,
  type Receipt,
  type Role,
  type Table,
  type WaTemplates,
} from "@/lib/erp";
import {
  ALL_BRANCHES,
  BRANCH_IDS,
  company,
  initialBranches,
  initialScopes,
  type Branch,
  type BranchScope,
} from "@/lib/tenancy";
import {
  demoUsers,
  findDemoUser,
  type AppUser,
} from "@/lib/auth";
import {
  categoryName,
  initialCategories,
  initialCombos,
  initialMenus,
  initialModifierGroups,
  initialPriceLists,
  initialProducts,
  priceOf,
  type Combo,
  type Menu,
  type ModifierGroup,
  type PriceList,
  type Product,
  type ProductCategory,
} from "@/lib/erp-catalog";

type ModulesContext = {
  payments: Payment[];
  tickets: Ticket[];
  addTicket: (subject: string) => void;
  setTickets: (tickets: Ticket[]) => void;
  menuItems: MenuItem[];
  setMenuItems: (items: MenuItem[]) => void;
  /* Maestros de catálogo (ERP): el precio vive en la lista activa */
  products: Product[];
  setProducts: (p: Product[]) => void;
  categories: ProductCategory[];
  setCategories: (c: ProductCategory[]) => void;
  modifierGroups: ModifierGroup[];
  setModifierGroups: (g: ModifierGroup[]) => void;
  priceLists: PriceList[];
  setPriceLists: (l: PriceList[]) => void;
  setActivePriceList: (id: string) => void;
  priceOf: (productId: number) => number;
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
  waTemplates: WaTemplates;
  setWaTemplates: (t: WaTemplates) => void;
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
  expenses: Expense[];
  setExpenses: (e: Expense[]) => void;
  combos: Combo[];
  setCombos: (c: Combo[]) => void;
  menus: Menu[];
  setMenus: (m: Menu[]) => void;
  notifications: Notification[];
  hasUnread: boolean;
  notify: (title: string, message: string) => void;
  clearUnread: () => void;
  /* Sesión mock (fase 1; la API real llega en fase 3) */
  currentUser: AppUser | null;
  login: (email: string) => AppUser | null;
  logout: () => void;
};

const Ctx = createContext<ModulesContext | null>(null);

type ScopeItem = { id: number | string };

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

export function ModulesProvider({
  children,
  initialPayments,
}: {
  children: React.ReactNode;
  initialPayments: Payment[];
}) {
  const [payments] = useState<Payment[]>(initialPayments);
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuData);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<ProductCategory[]>(initialCategories);
  const [modifierGroups, setModifierGroups] =
    useState<ModifierGroup[]>(initialModifierGroups);
  const [priceLists, setPriceLists] = useState<PriceList[]>(initialPriceLists);
  const [scopes, setScopes] = useState<Record<string, BranchScope>>(initialScopes);
  const [activeBranchId, setActiveBranchId] = useState<string>("todas");
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [waTemplates, setWaTemplates] = useState<WaTemplates>(initialWaTemplates);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons);

  // Sesión persistida (hidrata tras el montaje para no romper el SSR)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("fogoneria:user");
      const found = demoUsers.find((u) => u.id === raw);
      if (found) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde localStorage (solo cliente)
        setCurrentUser(found);
        if (found.branchId) {
          setActiveBranchId(found.branchId);
        } else {
          const branch = localStorage.getItem("fogoneria:branch");
          if (branch && (branch === "todas" || initialScopes[branch])) setActiveBranchId(branch);
        }
      }
    } catch {
      /* almacenamiento no disponible */
    }
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

  const login = useCallback((email: string): AppUser | null => {
    const user = findDemoUser(email);
    if (!user) return null;
    setCurrentUser(user);
    try {
      localStorage.setItem("fogoneria:user", user.id);
      document.cookie = `fogoneria.role=${user.role}; path=/; max-age=604800`;
      document.cookie = `fogoneria.branch=${user.branchId ?? "todas"}; path=/; max-age=604800`;
    } catch {
      /* almacenamiento no disponible */
    }
    if (user.branchId) setActiveBranchId(user.branchId);
    return user;
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    try {
      localStorage.removeItem("fogoneria:user");
      document.cookie = "fogoneria.role=; path=/; max-age=0";
      document.cookie = "fogoneria.branch=; path=/; max-age=0";
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);

  const isGeneral = activeBranchId === "todas";

  const activeScope: BranchScope = useMemo(() => {
    if (!isGeneral) return scopes[activeBranchId] ?? initialScopes.miraflores;
    return {
      orders: BRANCH_IDS.flatMap((id) => scopes[id]?.orders ?? []),
      tables: BRANCH_IDS.flatMap((id) => scopes[id]?.tables ?? []),
      cash: BRANCH_IDS.flatMap((id) => scopes[id]?.cash ?? []),
    };
  }, [scopes, activeBranchId, isGeneral]);

  const branchOf = useCallback(
    (kind: keyof BranchScope, id: number | string): Branch | null => {
      for (const b of initialBranches) {
        const list = (scopes[b.id]?.[kind] ?? []) as Array<{ id: number | string }>;
        if (list.some((o) => o.id === id)) return b;
      }
      return initialBranches[0] ?? null;
    },
    [scopes],
  );

  const setOrders: React.Dispatch<React.SetStateAction<Order[]>> = useCallback(
    (v) => setScopes((prev) => applyWrite(prev, activeBranchId, "orders", v)),
    [activeBranchId],
  );
  const setTables: React.Dispatch<React.SetStateAction<Table[]>> = useCallback(
    (v) => setScopes((prev) => applyWrite(prev, activeBranchId, "tables", v)),
    [activeBranchId],
  );
  const setCashMovements: React.Dispatch<React.SetStateAction<CashMovement[]>> = useCallback(
    (v) => setScopes((prev) => applyWrite(prev, activeBranchId, "cash", v)),
    [activeBranchId],
  );
  const [receipts, setReceipts] = useState<Receipt[]>(initialReceipts);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [combos, setCombos] = useState<Combo[]>(initialCombos);
  const [menus, setMenus] = useState<Menu[]>(initialMenus);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasUnread, setHasUnread] = useState(false);

  const notify = useCallback((title: string, message: string) => {
    setNotifications((prev) => [
      { id: Date.now(), title, message, timestamp: Date.now() },
      ...prev,
    ]);
    setHasUnread(true);
  }, []);

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
    [notify],
  );

  const setActivePriceList = useCallback((id: string) => {
    setPriceLists((prev) => prev.map((l) => ({ ...l, active: l.id === id })));
  }, []);

  const priceOfCallback = useCallback(
    (productId: number) => priceOf(productId, priceLists),
    [priceLists],
  );

  const categoryNameOf = useCallback(
    (categoryId: string) => categoryName(categoryId, categories),
    [categories],
  );

  const value = useMemo<ModulesContext>(
    () => ({
      payments,
      tickets,
      addTicket,
      setTickets: setTickets,
      menuItems,
      setMenuItems,
      products,
      setProducts,
      categories,
      setCategories,
      modifierGroups,
      setModifierGroups,
      priceLists,
      setPriceLists,
      setActivePriceList,
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
      roles,
      setRoles,
      waTemplates,
      setWaTemplates,
      customers,
      setCustomers,
      coupons,
      setCoupons,
      cashMovements: activeScope.cash,
      setCashMovements,
      receipts,
      setReceipts,
      expenses,
      setExpenses,
      combos,
      setCombos,
      menus,
      setMenus,
      notifications,
      hasUnread,
      notify,
      clearUnread: () => setHasUnread(false),
      currentUser,
      login,
      logout,
    }),
    [
      payments,
      tickets,
      addTicket,
      setTickets,
      menuItems,
      products,
      categories,
      modifierGroups,
      priceLists,
      setActivePriceList,
      priceOfCallback,
      categoryNameOf,
      activeBranchId,
      isGeneral,
      setActiveBranch,
      branchOf,
      setOrders,
      setTables,
      activeScope,
      roles,
      waTemplates,
      customers,
      coupons,
      setCashMovements,
      receipts,
      expenses,
      combos,
      menus,
      notifications,
      hasUnread,
      notify,
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
