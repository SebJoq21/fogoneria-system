export type MenuItem = {
  id: number;
  name: string;
  description: string;
  price: string;
  category: string;
  image: string;
  status: string;
};

export type Ticket = {
  id: string;
  subject: string;
  status: string;
  updated: string;
};

export type Payment = {
  id: number;
  date: string;
  concept: string;
  amount: string;
  status: string;
  type: "plan" | "module";
  day: number;
};

export type Service = {
  id: number;
  name: string;
  domain: string;
  plan: string;
  status: "activo" | "pendiente";
};

export type Notification = {
  id: number;
  title: string;
  message: string;
  timestamp: number;
};

export type Proposal = { title: string; description: string; value?: string };
export type Module = {
  id: string;
  title: string;
  description: string;
  price: string;
};

export const initialMenuData: MenuItem[] = [
  { id: 1, name: "Ceviche Clásico", description: "Pesca del día marinada en limón sutil, ají limo, cebolla roja y culantro. Acompañado de choclo y camote.", price: "15.00", category: "Entradas", image: "https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=600&q=80", status: "Activo" },
  { id: 2, name: "Tequeños de Lomo", description: "Masa crujiente rellena de nuestro clásico lomo saltado, acompañados de salsa huancaína.", price: "8.00", category: "Entradas", image: "https://images.unsplash.com/photo-1541529086526-db283c563270?auto=format&fit=crop&w=600&q=80", status: "Activo" },
  { id: 3, name: "Lomo Saltado", description: "Trozos de lomo fino salteados al wok con cebolla, tomate, ají amarillo y sillao. Servido con papas fritas y arroz.", price: "22.00", category: "Fondos", image: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=600&q=80", status: "Activo" },
  { id: 4, name: "Ají de Gallina", description: "Cremoso guiso de pechuga de pollo deshilachada con ají amarillo, pecanas y queso parmesano.", price: "18.00", category: "Fondos", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80", status: "Activo" },
  { id: 5, name: "Pisco Sour", description: "Nuestro cóctel bandera. Pisco Quebranta, zumo de limón, jarabe de goma, clara de huevo y amargo de Angostura.", price: "10.00", category: "Bebidas", image: "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=600&q=80", status: "Activo" },
  { id: 6, name: "Chicha Morada", description: "Refrescante bebida tradicional a base de maíz morado, piña, manzana, canela y clavo de olor.", price: "4.00", category: "Bebidas", image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80", status: "Activo" },
];

export const initialTickets: Ticket[] = [
  { id: "#TK-0012", subject: "Actualizar menú de temporada", status: "En proceso", updated: "Hoy, 10:30 AM" },
  { id: "#TK-0008", subject: "Duda sobre reservas", status: "Resuelto", updated: "Hace 2 días" },
];

export const initialPayments: Payment[] = [
  { id: 1, date: "01 Ago 2026", concept: "Plan Profesional - Mensualidad", amount: "$70.00", status: "Pagado", type: "plan", day: 1 },
];

export const services: Service[] = [
  { id: 1, name: "Cevichería El Puerto", domain: "www.cevicheriaelpuerto.com", plan: "Plan Profesional", status: "activo" },
  { id: 2, name: "Pizzería La Nonna", domain: "www.lanonna.com", plan: "Plan Básico", status: "pendiente" },
];

export const dataVisitas = [
  { name: "Lun", v: 800 }, { name: "Mar", v: 950 }, { name: "Mié", v: 1100 }, { name: "Jue", v: 1050 }, { name: "Vie", v: 1245 },
];
export const dataQR = [
  { name: "Lun", v: 400 }, { name: "Mar", v: 300 }, { name: "Mié", v: 550 }, { name: "Jue", v: 700 }, { name: "Vie", v: 850 },
];
export const dataReservas = [
  { name: "Lun", v: 50 }, { name: "Mar", v: 65 }, { name: "Mié", v: 80 }, { name: "Jue", v: 95 }, { name: "Vie", v: 112 },
];
export const dataWsp = [
  { name: "Lun", v: 15 }, { name: "Mar", v: 20 }, { name: "Mié", v: 28 }, { name: "Jue", v: 35 }, { name: "Vie", v: 45 },
];
