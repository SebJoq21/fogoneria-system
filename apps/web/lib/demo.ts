export type DemoTemplate = "elegant" | "playful" | "minimalist";

export type DemoItem = { name: string; desc: string; price: string; image?: string };

export type Demo = {
  name: string;
  slogan: string;
  theme: string;
  textColor: string;
  template: DemoTemplate;
  heroBg: string;
  about?: { description: string; years: string; location: string; schedule: string; image: string };
  items: DemoItem[];
};

export const demoData: Record<string, Demo> = {
  criolla: {
    name: "Sentimiento Peruano",
    slogan: "El verdadero sabor de casa",
    theme: "bg-orange-600",
    textColor: "text-orange-500",
    template: "elegant",
    heroBg: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
    about: {
      description: "Desde hace más de 15 años, nos dedicamos a rescatar las recetas de antaño, aquellas que se cocinaban a fuego lento en las ollas de barro de nuestras abuelas. Cada plato es un homenaje a la rica herencia culinaria del Perú, utilizando ingredientes frescos y de origen local.",
      years: "15+ Años de Tradición",
      location: "Av. José Pardo 456, Miraflores - Lima",
      schedule: "Martes a Domingo: 12:00 PM - 10:30 PM",
      image: "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    },
    items: [
      { name: "Ceviche Clásico", desc: "Pesca del día, leche de tigre al ají limo, cebolla roja, camote glaseado y choclo.", price: "$18.00", image: "https://images.unsplash.com/photo-1534939561126-855b8675edd7?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80" },
      { name: "Causa Limeña", desc: "Suave masa de papa amarilla con ají, rellena de pulpa de cangrejo y palta.", price: "$12.00", image: "https://images.unsplash.com/photo-1626074353765-517a681e40be?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80" },
      { name: "Lomo Saltado", desc: "Fino corte de lomo de res flameado al pisco, cebolla, tomate, ají amarillo y papas nativas.", price: "$22.00", image: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80" },
      { name: "Arroz con Pato", desc: "Arroz graneado al culantro y chicha de jora, tierna pierna de pato confitada y sarsa criolla.", price: "$24.00", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80" },
      { name: "Ají de Gallina", desc: "Crema de ají amarillo, nueces y queso parmesano, servida con pechuga deshilachada y papas.", price: "$16.00", image: "https://images.unsplash.com/photo-1604908177422-77119dd225d3?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80" },
      { name: "Anticuchos de Corazón", desc: "Macerados en ají panca y vinagre, a la parrilla, con papas doradas y salsa de rocoto.", price: "$14.00", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80" },
    ],
  },
  postres: {
    name: "Tu postre a la limeña",
    slogan: "Dulzura artesanal en cada bocado",
    theme: "bg-pink-500",
    textColor: "text-pink-600",
    template: "playful",
    heroBg: "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
    items: [
      { name: "Cupcake de Fresa", desc: "Bizcocho suave con frosting de fresas frescas.", price: "$4.00" },
      { name: "Macarons Surtidos", desc: "Caja de 6 macarons de distintos sabores.", price: "$12.00" },
      { name: "Tarta de Limón", desc: "Masa quebrada con crema de limón y merengue.", price: "$6.50" },
    ],
  },
  cafe: {
    name: "Café Express",
    slogan: "Tu pausa perfecta del día",
    theme: "bg-slate-900",
    textColor: "text-slate-900",
    template: "minimalist",
    heroBg: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
    items: [
      { name: "Espresso Doble", desc: "Grano seleccionado de tueste oscuro.", price: "$3.50" },
      { name: "Capuccino Artesanal", desc: "Espresso con leche cremada y cacao.", price: "$4.50" },
      { name: "Croissant de Mantequilla", desc: "Horneado del día, crujiente por fuera.", price: "$3.00" },
    ],
  },
};
