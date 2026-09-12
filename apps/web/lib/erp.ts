export type ModuleId =
  | "whatsapp"
  | "fidelizacion"
  | "reservas"
  | "inventario"
  | "trabajadores";

export type ModuleMeta = {
  id: ModuleId;
  title: string;
  description: string;
  price: string;
  benefits: [string, string, string];
};

export const MODULE_CATALOG: ModuleMeta[] = [
  {
    id: "whatsapp",
    title: "Automatización de WhatsApp",
    description:
      "Envía recordatorios automáticos de reservas y confirmaciones de pedidos directamente al WhatsApp de tus clientes.",
    price: "+$25.00/mes",
    benefits: [
      "Confirmaciones de pedido automáticas al instante",
      "Recordatorios de reserva que reducen no-shows",
      "Historial de envíos con estado de entrega",
    ],
  },
  {
    id: "fidelizacion",
    title: "Sistema de Fidelización",
    description:
      "Crea cupones de descuento y acumulación de puntos para premiar a tus clientes más frecuentes.",
    price: "+$20.00/mes",
    benefits: [
      "Cupones con límite de usos y vencimiento",
      "Puntos por cada dólar gastado",
      "Base de clientes frecuentes registrados",
    ],
  },
  {
    id: "reservas",
    title: "Gestión de Reservas",
    description:
      "Permite a tus clientes reservar mesas online con confirmación instantánea y mapa interactivo del local.",
    price: "+$15.00/mes",
    benefits: [
      "Mapa de mesas en tiempo real",
      "Confirmación instantánea de reservas",
      "Agenda y calendario de turnos",
    ],
  },
  {
    id: "inventario",
    title: "Gestor de Inventarios",
    description:
      "Controla el stock de tus ingredientes en tiempo real, con alertas automáticas de insumos por agotarse.",
    price: "+$30.00/mes",
    benefits: [
      "Alertas de nivel crítico de stock",
      "Escandallo: descuento automático por plato",
      "Ajustes de stock con historial",
    ],
  },
  {
    id: "trabajadores",
    title: "Gestor de Trabajadores",
    description:
      "Administra horarios, turnos, propinas y desempeño de tu equipo de mozos y personal de cocina.",
    price: "+$25.00/mes",
    benefits: [
      "Directorio con turnos en vivo",
      "Planificador semanal de turnos",
      "Reparto equitativo de propinas",
    ],
  },
];

/* ---------- Pedidos Web ---------- */

export type OrderStatus = "cocina" | "listo" | "entregado";

export type Order = {
  id: string;
  customer: string;
  items: { name: string; qty: number }[];
  total: string;
  time: string;
  elapsed: string;
  status: OrderStatus;
  channel: "Web" | "QR mesa";
  /** Mesero que tomó la orden (para "mis órdenes") */
  waiter?: string;
};

export const initialOrders: Order[] = [
  { id: "#PD-1042", customer: "Valeria Ríos", items: [{ name: "Lomo Saltado", qty: 2 }, { name: "Chicha Morada", qty: 2 }], total: "$52.00", time: "13:42", elapsed: "hace 6 min", status: "cocina", channel: "Web" },
  { id: "#PD-1041", customer: "Mesa 7", items: [{ name: "Ceviche Clásico", qty: 1 }, { name: "Pisco Sour", qty: 2 }], total: "$35.00", time: "13:35", elapsed: "hace 13 min", status: "cocina", channel: "QR mesa", waiter: "Ana Beltrán" },
  { id: "#PD-1040", customer: "Diego Torres", items: [{ name: "Ají de Gallina", qty: 1 }], total: "$18.00", time: "13:28", elapsed: "hace 20 min", status: "listo", channel: "Web" },
  { id: "#PD-1039", customer: "Mesa 3", items: [{ name: "Tequeños de Lomo", qty: 2 }, { name: "Chicha Morada", qty: 1 }], total: "$20.00", time: "13:15", elapsed: "hace 33 min", status: "entregado", channel: "QR mesa" },
];

/* ---------- WhatsApp ---------- */

export type WhatsappLog = {
  id: number;
  datetime: string;
  phone: string;
  event: "Pedido" | "Reserva";
  status: "Entregado" | "Fallido";
};

export const initialWhatsappLogs: WhatsappLog[] = [
  { id: 1, datetime: "Hoy 13:44", phone: "+51 987 112 203", event: "Pedido", status: "Entregado" },
  { id: 2, datetime: "Hoy 13:31", phone: "+51 955 804 117", event: "Reserva", status: "Entregado" },
  { id: 3, datetime: "Hoy 12:58", phone: "+51 901 445 882", event: "Pedido", status: "Fallido" },
  { id: 4, datetime: "Hoy 12:20", phone: "+51 988 230 541", event: "Reserva", status: "Entregado" },
];

/* ---------- Fidelización ---------- */

export type Coupon = {
  code: string;
  discount: string;
  used: number;
  limit: number;
  expires: string;
};

export const initialCoupons: Coupon[] = [
  { code: "BURGER10", discount: "10% OFF", used: 45, limit: 100, expires: "30 Nov 2026" },
  { code: "PISCO5", discount: "$5.00 Descuento", used: 12, limit: 50, expires: "15 Dic 2026" },
  { code: "FIEL20", discount: "20% OFF", used: 78, limit: 80, expires: "31 Oct 2026" },
];

/* ---------- Reservas ---------- */

export type TableStatus = "libre" | "ocupada" | "reservada";
export type TableShape = "round" | "rect";

export type Table = { id: number; label: string; seats: number; shape: TableShape; status: TableStatus; zone: string };

export const initialTables: Table[] = [
  { id: 1, label: "Mesa 1", seats: 2, shape: "round", status: "libre", zone: "Terraza" },
  { id: 2, label: "Mesa 2", seats: 2, shape: "round", status: "ocupada", zone: "Terraza" },
  { id: 3, label: "Mesa 3", seats: 4, shape: "rect", status: "reservada", zone: "Salón" },
  { id: 4, label: "Mesa 4", seats: 4, shape: "rect", status: "libre", zone: "Salón" },
  { id: 5, label: "Mesa 5", seats: 6, shape: "rect", status: "ocupada", zone: "Salón" },
  { id: 6, label: "Mesa 6", seats: 2, shape: "round", status: "libre", zone: "Barra" },
  { id: 7, label: "Mesa 7", seats: 4, shape: "rect", status: "ocupada", zone: "Barra" },
  { id: 8, label: "Mesa 8", seats: 8, shape: "rect", status: "reservada", zone: "Salón" },
];

export type Reservation = {
  id: string;
  customer: string;
  guests: number;
  phone: string;
  time: string;
  notes: string;
  tableId: number;
};

export const initialReservations: Reservation[] = [
  { id: "RS-201", customer: "Camila Duarte", guests: 4, phone: "+51 987 442 019", time: "Hoy 20:00", notes: "Mesa cerca a la ventana, una silla de bebé.", tableId: 3 },
  { id: "RS-202", customer: "Jorge Paredes", guests: 8, phone: "+51 955 128 774", time: "Hoy 21:30", notes: "Cumpleaños, llevarán torta.", tableId: 8 },
];

/* ---------- Inventario ---------- */

export type StockState = "Óptimo" | "Bajo" | "Agotado";

export type Ingredient = {
  id: number;
  name: string;
  category: string;
  stock: number;
  min: number;
  unit: string;
  state: StockState;
};

export const initialIngredients: Ingredient[] = [
  { id: 1, name: "Lomo fino", category: "Carnes", stock: 12, min: 5, unit: "kg", state: "Óptimo" },
  { id: 2, name: "Ají amarillo", category: "Vegetales", stock: 1.5, min: 3, unit: "kg", state: "Bajo" },
  { id: 3, name: "Pisco Quebranta", category: "Bar", stock: 0, min: 2, unit: "litros", state: "Agotado" },
  { id: 4, name: "Papa amarilla", category: "Vegetales", stock: 20, min: 8, unit: "kg", state: "Óptimo" },
  { id: 5, name: "Limón sutil", category: "Frutas", stock: 2, min: 4, unit: "kg", state: "Bajo" },
  { id: 6, name: "Maíz morado", category: "Granos", stock: 6, min: 2, unit: "kg", state: "Óptimo" },
];

export type RecipeLine = { ingredientId: number; qty: number };

/* ---------- Trabajadores ---------- */

export type Employee = {
  id: number;
  name: string;
  role: "Mozo" | "Cocinero" | "Barman" | "Cajero";
  initials: string;
  onShift: boolean;
};

export const initialEmployees: Employee[] = [
  { id: 1, name: "Rosa Quispe", role: "Mozo", initials: "RQ", onShift: true },
  { id: 2, name: "Luis Huamán", role: "Cocinero", initials: "LH", onShift: true },
  { id: 3, name: "Ana Beltrán", role: "Barman", initials: "AB", onShift: true },
  { id: 4, name: "Pedro León", role: "Cajero", initials: "PL", onShift: false },
  { id: 5, name: "María Flores", role: "Mozo", initials: "MF", onShift: false },
  { id: 6, name: "Carlos Vega", role: "Cocinero", initials: "CV", onShift: true },
];

export const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export type ShiftBlock = { employeeId: number; day: number; shift: "M" | "T" };

export const initialShifts: ShiftBlock[] = [
  { employeeId: 1, day: 0, shift: "M" }, { employeeId: 1, day: 1, shift: "M" },
  { employeeId: 1, day: 4, shift: "T" }, { employeeId: 1, day: 5, shift: "T" },
  { employeeId: 2, day: 0, shift: "T" }, { employeeId: 2, day: 2, shift: "M" },
  { employeeId: 2, day: 5, shift: "M" }, { employeeId: 3, day: 3, shift: "T" },
  { employeeId: 3, day: 4, shift: "T" }, { employeeId: 3, day: 5, shift: "T" },
  { employeeId: 4, day: 1, shift: "M" }, { employeeId: 5, day: 5, shift: "M" },
  { employeeId: 6, day: 4, shift: "M" }, { employeeId: 6, day: 6, shift: "M" },
];

/* ---------- Fidelización: base de clientes ---------- */

export type Customer = {
  id: number;
  name: string;
  phone: string;
  points: number;
  visits: number;
  segment: "Frecuente" | "Nuevo" | "VIP";
  lastVisit: string;
};

export const initialCustomers: Customer[] = [
  { id: 1, name: "Valeria Ríos", phone: "+51 987 112 203", points: 1240, visits: 32, segment: "VIP", lastVisit: "Hoy" },
  { id: 2, name: "Diego Torres", phone: "+51 955 804 117", points: 860, visits: 21, segment: "Frecuente", lastVisit: "Ayer" },
  { id: 3, name: "Camila Duarte", phone: "+51 901 445 882", points: 410, visits: 9, segment: "Frecuente", lastVisit: "Hace 3 días" },
  { id: 4, name: "Jorge Paredes", phone: "+51 988 230 541", points: 120, visits: 2, segment: "Nuevo", lastVisit: "Hace 1 sem" },
  { id: 5, name: "Lucía Prado", phone: "+51 976 551 309", points: 2310, visits: 48, segment: "VIP", lastVisit: "Hoy" },
];

/* ---------- Inventarios: kardex de movimientos ---------- */

export type StockMovement = {
  id: number;
  datetime: string;
  type: "Entrada" | "Salida" | "Ajuste";
  ingredient: string;
  qty: string;
  reason: string;
};

export const initialMovements: StockMovement[] = [
  { id: 1, datetime: "Hoy 13:50", type: "Salida", ingredient: "Lomo fino", qty: "-1.5 kg", reason: "Venta · comandas #PD-1042" },
  { id: 2, datetime: "Hoy 11:20", type: "Entrada", ingredient: "Papa amarilla", qty: "+20 kg", reason: "Recepción OC-031 · AgroAndina" },
  { id: 3, datetime: "Hoy 09:05", type: "Ajuste", ingredient: "Ají amarillo", qty: "-0.5 kg", reason: "Merma de cocina" },
  { id: 4, datetime: "Ayer 18:40", type: "Salida", ingredient: "Pisco Quebranta", qty: "-2 litros", reason: "Venta · barra" },
  { id: 5, datetime: "Ayer 10:15", type: "Entrada", ingredient: "Limón sutil", qty: "+5 kg", reason: "Recepción OC-030 · Frutas Lima" },
];

/* ---------- Trabajadores: roles ---------- */

export type Role = { id: string; name: string; description: string };

export const initialRoles: Role[] = [
  { id: "mozo", name: "Mozo", description: "Atención en mesa, comandas y servicio al comensal." },
  { id: "cocinero", name: "Cocinero", description: "Preparación de platos y control de comandas en cocina." },
  { id: "barman", name: "Barman", description: "Bebidas, coctelería y barra." },
  { id: "cajero", name: "Cajero", description: "Cobros, caja y cierre de turno." },
];

/* ---------- WhatsApp: plantillas por evento ---------- */

export type WaTemplates = { order: string; reminder: string };

export const initialWaTemplates: WaTemplates = {
  order: "Hola {nombre_cliente}, tu pedido {numero_pedido} está confirmado y ya entró a cocina.",
  reminder: "Hola {nombre_cliente}, te recordamos tu reserva para {fecha_reserva}. ¡Te esperamos!",
};

/* ---------- Promociones programadas ---------- */

export type PromoSchedule = {
  id: number;
  name: string;
  kind: string;
  validity: string;
  active: boolean;
};

export const initialPromos: PromoSchedule[] = [
  { id: 1, name: "Happy Hour Pisco", kind: "2x1 en barra", validity: "Lun–Vie · 18:00–20:00", active: true },
  { id: 2, name: "Almuerzo Ejecutivo", kind: "$5.00 off", validity: "Lun–Vie · 12:00–15:00", active: true },
  { id: 3, name: "Domingo Familiar", kind: "15% OFF", validity: "Dom · todo el día", active: false },
];

/* ---------- Caja: movimientos del turno ---------- */

export type CashMovement = {
  id: number;
  datetime: string;
  concept: string;
  kind: "Ingreso" | "Egreso";
  amount: number;
  method: string;
};

export const initialCashMovements: CashMovement[] = [
  { id: 1, datetime: "Hoy 13:55", concept: "Venta mesa 7", kind: "Ingreso", amount: 35.0, method: "Yape" },
  { id: 2, datetime: "Hoy 13:20", concept: "Venta web #PD-1042", kind: "Ingreso", amount: 52.0, method: "Tarjeta" },
  { id: 3, datetime: "Hoy 11:05", concept: "Compra hielo", kind: "Egreso", amount: 12.0, method: "Efectivo" },
  { id: 4, datetime: "Hoy 09:00", concept: "Fondo de apertura", kind: "Ingreso", amount: 200.0, method: "Efectivo" },
];

/* ---------- Comprobantes de venta ---------- */

export type Receipt = {
  id: string;
  date: string;
  customer: string;
  total: string;
  status: "Pagada" | "Anulada";
  source: string;
};

export const initialReceipts: Receipt[] = [
  { id: "B001-1042", date: "Hoy 13:42", customer: "Valeria Ríos", total: "$52.00", status: "Pagada", source: "Orden #PD-1042" },
  { id: "B001-1041", date: "Hoy 13:35", customer: "Mesa 7", total: "$35.00", status: "Pagada", source: "Mesa 7" },
  { id: "B001-1040", date: "Hoy 13:28", customer: "Diego Torres", total: "$18.00", status: "Anulada", source: "Orden #PD-1040" },
];

/* ---------- Gastos ---------- */

export type Expense = {
  id: number;
  date: string;
  category: string;
  supplier: string;
  amount: string;
  status: "Pagado" | "Pendiente";
};

export const expenseCategories = ["Insumos", "Servicios", "Personal", "Alquiler", "Marketing", "Otros"];

export const initialExpenses: Expense[] = [
  { id: 1, date: "Hoy", category: "Insumos", supplier: "AgroAndina", amount: "$120.00", status: "Pagado" },
  { id: 2, date: "Ayer", category: "Servicios", supplier: "Luz del Sur", amount: "$85.50", status: "Pendiente" },
  { id: 3, date: "Ayer", category: "Personal", supplier: "Planilla semanal", amount: "$950.00", status: "Pendiente" },
];

/* ---------- Trabajadores: asistencia semanal ---------- */

export type AttendanceMark = { employeeId: number; day: number; present: boolean };

export const initialAttendance: AttendanceMark[] = [
  { employeeId: 1, day: 0, present: true }, { employeeId: 1, day: 1, present: true },
  { employeeId: 1, day: 2, present: false }, { employeeId: 1, day: 3, present: true },
  { employeeId: 1, day: 4, present: true },
  { employeeId: 2, day: 0, present: true }, { employeeId: 2, day: 1, present: true },
  { employeeId: 2, day: 2, present: true }, { employeeId: 2, day: 3, present: false },
  { employeeId: 2, day: 4, present: true },
  { employeeId: 3, day: 0, present: false }, { employeeId: 3, day: 1, present: true },
  { employeeId: 3, day: 2, present: true }, { employeeId: 3, day: 3, present: true },
  { employeeId: 3, day: 4, present: true },
  { employeeId: 6, day: 0, present: true }, { employeeId: 6, day: 1, present: false },
  { employeeId: 6, day: 2, present: true }, { employeeId: 6, day: 3, present: true },
  { employeeId: 6, day: 4, present: true },
];
