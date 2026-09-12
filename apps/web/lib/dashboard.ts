/** Vista derivada de Carta (nunca se persiste): Plato + precio lista activa + tipo. */
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
export const dataReservas = [
  { name: "Lun", v: 50 }, { name: "Mar", v: 65 }, { name: "Mié", v: 80 }, { name: "Jue", v: 95 }, { name: "Vie", v: 112 },
];
