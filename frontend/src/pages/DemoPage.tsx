import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const demoData = {
  criolla: {
    name: 'Sentimiento Peruano',
    slogan: 'El verdadero sabor de casa',
    theme: 'bg-orange-600',
    textColor: 'text-orange-500',
    template: 'elegant',
    heroBg: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80',
    about: {
      description: 'Desde hace más de 15 años, nos dedicamos a rescatar las recetas de antaño, aquellas que se cocinaban a fuego lento en las ollas de barro de nuestras abuelas. Cada plato es un homenaje a la rica herencia culinaria del Perú, utilizando ingredientes frescos y de origen local.',
      years: '15+ Años de Tradición',
      location: 'Av. José Pardo 456, Miraflores - Lima',
      schedule: 'Martes a Domingo: 12:00 PM - 10:30 PM',
      image: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
    },
    items: [
      { name: 'Ceviche Clásico', desc: 'Pesca del día, leche de tigre al ají limo, cebolla roja, camote glaseado y choclo.', price: '$18.00', image: 'https://images.unsplash.com/photo-1534939561126-855b8675edd7?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
      { name: 'Causa Limeña', desc: 'Suave masa de papa amarilla con ají, rellena de pulpa de cangrejo y palta.', price: '$12.00', image: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
      { name: 'Lomo Saltado', desc: 'Fino corte de lomo de res flameado al pisco, cebolla, tomate, ají amarillo y papas nativas.', price: '$22.00', image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
      { name: 'Arroz con Pato', desc: 'Arroz graneado al culantro y chicha de jora, tierna pierna de pato confitada y sarsa criolla.', price: '$24.00', image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
      { name: 'Ají de Gallina', desc: 'Crema de ají amarillo, nueces y queso parmesano, servida con pechuga deshilachada y papas.', price: '$16.00', image: 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
      { name: 'Anticuchos de Corazón', desc: 'Macerados en ají panca y vinagre, a la parrilla, con papas doradas y salsa de rocoto.', price: '$14.00', image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' }
    ]
  },
  postres: {
    name: 'Tu postre a la limeña',
    slogan: 'Dulzura artesanal en cada bocado',
    theme: 'bg-pink-500',
    textColor: 'text-pink-600',
    template: 'playful',
    heroBg: 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80',
    about: {
      description: 'Somos una dulcería limeña que combina la tradición con la innovación. Cada postre está hecho con ingredientes naturales y mucho amor.',
      years: '8 Años de Dulzura',
      location: 'Jr. de la Unión 320, Cercado - Lima',
      schedule: 'Lunes a Sábado: 10:00 AM - 8:00 PM',
      image: 'https://images.unsplash.com/photo-1556217477-d325251ece38?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
    },
    categories: [
      {
        name: 'Tortas',
        items: [
          { name: 'Tres Leches', desc: 'Bizcocho esponjoso bañado en tres leches, con merengue italiano.', price: '$8.00', image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
          { name: 'Tarta de Chocolate', desc: 'Capas de chocolate belga con mousse de avellana.', price: '$9.50', image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
          { name: 'Tarta de Limón', desc: 'Masa quebrada con crema de limón y merengue flambeado.', price: '$7.50', image: 'https://images.unsplash.com/photo-1519915028121-7d3463d20b13?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
        ]
      },
      {
        name: 'Pasteles Individuales',
        items: [
          { name: 'Suspiro Limeño', desc: 'El postre más criollo: manjar blanco con merengue y canela.', price: '$6.50', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
          { name: 'Cupcake de Vainilla', desc: 'Bizcocho de vainilla bourbon con frosting de mantequilla.', price: '$4.00', image: 'https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
          { name: 'Tiramisú', desc: 'Capas de bizcocho de café con crema de mascarpone.', price: '$7.00', image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
        ]
      },
      {
        name: 'Galletas y Extras',
        items: [
          { name: 'Alfajores de Maicena', desc: 'Caja de 6 alfajores rellenos de manjar blanco y coco.', price: '$12.00', image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
          { name: 'Macarons Surtidos', desc: 'Caja de 6 macarons de distintos sabores artesanales.', price: '$14.00', image: 'https://images.unsplash.com/photo-1569864358642-9d1684040f43?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
          { name: 'Brownie de Chocolate', desc: 'Brownie denso con trozos de chocolate belga y nuez.', price: '$5.50', image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
        ]
      }
    ]
  },
  cafe: {
    name: 'Café Express',
    slogan: 'Tu pausa perfecta del día',
    theme: 'bg-slate-900',
    textColor: 'text-slate-900',
    template: 'minimalist',
    heroBg: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80',
    about: {
      description: 'Café de especialidad con granos seleccionados de las mejores regiones del Perú. Cada taza es una experiencia única.',
      years: '5 Años de Espresso',
      location: 'Av. Larco 789, Miraflores - Lima',
      schedule: 'Lunes a Domingo: 7:00 AM - 9:00 PM',
      image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
    },
    categories: [
      {
        name: 'Cafés',
        items: [
          { name: 'Espresso Doble', desc: 'Grano seleccionado de tueste oscuro, notas intensas.', price: '$3.50', image: 'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
          { name: 'Capuccino Artesanal', desc: 'Espresso con leche cremada y arte latte.', price: '$4.50', image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
          { name: 'Flat White', desc: 'Doble espresso con microespuma de leche suave.', price: '$4.80', image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
          { name: 'Cold Brew', desc: 'Café frío de extracción lenta, 12 horas de maceración.', price: '$5.00', image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
        ]
      },
      {
        name: 'Repostería',
        items: [
          { name: 'Croissant de Mantequilla', desc: 'Horneado del día, crujiente por fuera, suave por dentro.', price: '$3.00', image: 'https://images.unsplash.com/photo-1555507036-ab1f4038024a?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
          { name: 'Avocado Toast', desc: 'Pan artesanal con aguacate, huevos pochados y semillas.', price: '$7.50', image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
          { name: 'Muffin de Arándanos', desc: 'Bizcocho esponjoso con arándanos fresques y streusel.', price: '$3.80', image: 'https://images.unsplash.com/photo-1607114910221-3b4b6c00a3f6?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
        ]
      },
      {
        name: 'Desayunos',
        items: [
          { name: 'Desayuno Americano', desc: 'Huevos, tostada, bacon, jugo de naranja y café.', price: '$9.00', image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
          { name: 'Pancakes con Frutas', desc: 'Panqueques de avena con frutas frescas y miel de maple.', price: '$8.50', image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
        ]
      }
    ]
  }
};

export default function DemoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const data = demoData[id] || demoData.cafe;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleBack = () => {
    navigate('/#demos');
    setTimeout(() => {
      const el = document.getElementById('demos');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // 1. PLANTILLA: ELEGANTE (Restaurante Clásico - Modo Oscuro)
  const renderElegant = () => (
    <div className="min-h-screen bg-slate-950 text-white font-serif selection:bg-orange-500/30">
      {/* Hero */}
      <header className="relative w-full h-[70vh] flex items-center justify-center text-center">
        <div className="absolute inset-0 bg-black/70 z-10"></div>
        <img src={data.heroBg} alt={data.name} className="absolute inset-0 w-full h-full object-cover z-0 grayscale-[20%]" />
        <div className="relative z-20 px-4 py-12 flex flex-col items-center">
          <div className="w-px h-16 bg-orange-500/50 mb-8 mx-auto"></div>
          <h1 className="text-5xl md:text-7xl font-light tracking-[0.2em] uppercase mb-6">{data.name}</h1>
          <p className={`text-2xl ${data.textColor} italic font-light`}>{data.slogan}</p>
          <div className="w-px h-16 bg-orange-500/50 mt-8 mx-auto"></div>
        </div>
      </header>

      {/* Quiénes Somos */}
      <section className="w-full bg-slate-900 border-y border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="relative h-[500px] w-full hidden lg:block group overflow-hidden">
              <img src={data.about.image} alt="Nuestro Local" className="absolute inset-0 w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-700" />
              <div className="absolute inset-4 border border-white/20 z-10 pointer-events-none"></div>
            </div>
            <div className="flex flex-col gap-10">
              <div>
                <h2 className="text-sm tracking-[0.3em] uppercase text-slate-500 mb-4">Nuestra Historia</h2>
                <h3 className="text-3xl lg:text-4xl font-light leading-snug mb-6 text-slate-200">Rescatando la esencia de la gastronomía peruana.</h3>
                <p className="text-slate-400 font-sans font-light leading-relaxed mb-6 text-lg">{data.about.description}</p>
                <p className={`font-medium ${data.textColor} tracking-widest uppercase text-sm`}>{data.about.years}</p>
              </div>
              <div className="bg-white/5 border border-white/10 p-8 backdrop-blur-sm grid sm:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs tracking-widest uppercase text-slate-500 mb-2">Ubicación</h4>
                  <p className="text-slate-300 font-sans text-sm">{data.about.location}</p>
                </div>
                <div>
                  <h4 className="text-xs tracking-widest uppercase text-slate-500 mb-2">Horario</h4>
                  <p className="text-slate-300 font-sans text-sm">{data.about.schedule}</p>
                </div>
                <div className="sm:col-span-2 pt-4 border-t border-white/10">
                  <button className="w-full bg-slate-100 hover:bg-white text-slate-900 font-sans font-semibold py-3 transition-colors text-sm uppercase tracking-wider">Reservar una Mesa</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* La Carta */}
      <main className="w-full bg-slate-950">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <h2 className="text-3xl font-light text-center uppercase tracking-widest mb-2">La Carta</h2>
          <div className="w-12 h-px bg-orange-500 mx-auto mb-16"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-16">
            {data.items.map((item, i) => (
              <div key={i} className="flex gap-6 group cursor-pointer">
                <div className="w-24 h-24 sm:w-32 sm:h-32 shrink-0 overflow-hidden relative">
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors z-10"></div>
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                </div>
                <div className="flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-2 gap-4">
                    <h3 className="text-xl sm:text-2xl font-medium tracking-wide text-slate-200 group-hover:text-white transition-colors">{item.name}</h3>
                    <span className={`text-xl font-light ${data.textColor}`}>{item.price}</span>
                  </div>
                  <div className="w-full border-b border-dashed border-white/10 mb-3 hidden sm:block"></div>
                  <p className="text-slate-400 font-sans font-light text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );

  // 2. PLANTILLA: DIVERTIDA (Pastelería - Con imágenes y categorías)
  const renderPlayful = () => (
    <div className="min-h-screen bg-pink-50 font-sans">
      {/* Hero */}
      <header className="relative w-full h-[60vh] flex items-center justify-center">
        <div className="absolute inset-0 bg-pink-900/40 z-10"></div>
        <img src={data.heroBg} alt={data.name} className="absolute inset-0 w-full h-full object-cover z-0" />
        <div className="relative z-20 text-center px-4">
          <h1 className="text-5xl md:text-7xl font-black text-white mb-4 drop-shadow-lg">{data.name}</h1>
          <p className="text-xl text-pink-100 font-medium drop-shadow">{data.slogan}</p>
        </div>
      </header>

      {/* Sobre Nosotros */}
      <section className="bg-white py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-sm tracking-widest uppercase text-pink-400 mb-4 font-bold">Nuestra Historia</h2>
              <h3 className="text-3xl font-bold text-slate-800 mb-4">{data.about.years}</h3>
              <p className="text-slate-600 leading-relaxed mb-6">{data.about.description}</p>
              <div className="flex flex-col gap-2 text-sm text-slate-500">
                <p>📍 {data.about.location}</p>
                <p>🕐 {data.about.schedule}</p>
              </div>
            </div>
            <div className="relative h-[350px] rounded-3xl overflow-hidden shadow-xl">
              <img src={data.about.image} alt="Nuestro Local" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* Carta por Categorías */}
      <main className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          {data.categories.map((category, catIdx) => (
            <div key={catIdx} className="mb-16 last:mb-0">
              <h2 className="text-2xl font-bold text-slate-800 mb-8 text-center">{category.name}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {category.items.map((item, i) => (
                  <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group">
                    <div className="relative h-48 overflow-hidden">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full">
                        <span className="text-pink-600 font-bold">{item.price}</span>
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="text-lg font-bold text-slate-800 mb-2">{item.name}</h3>
                      <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );

  // 3. PLANTILLA: MINIMALISTA (Cafetería - Con imágenes y categorías)
  const renderMinimalist = () => (
    <div className="min-h-screen bg-[#FAFAF8] font-sans">
      {/* Hero */}
      <header className="relative w-full h-[70vh] flex items-center justify-start">
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent z-10"></div>
        <img src={data.heroBg} alt={data.name} className="absolute inset-0 w-full h-full object-cover z-0" />
        <div className="relative z-20 px-8 md:px-24 max-w-3xl">
          <div className="w-16 h-1 bg-amber-500 mb-6"></div>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 tracking-tight">{data.name}</h1>
          <p className="text-xl text-slate-300">{data.slogan}</p>
        </div>
      </header>

      {/* Sobre Nosotros */}
      <section className="bg-white py-16 border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative h-[350px] rounded-2xl overflow-hidden shadow-lg">
              <img src={data.about.image} alt="Nuestro Café" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-sm tracking-widest uppercase text-amber-600 mb-4 font-bold">Nuestro Café</h2>
              <h3 className="text-3xl font-bold text-slate-800 mb-4">{data.about.years}</h3>
              <p className="text-slate-600 leading-relaxed mb-6">{data.about.description}</p>
              <div className="flex flex-col gap-2 text-sm text-slate-500">
                <p>📍 {data.about.location}</p>
                <p>🕐 {data.about.schedule}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Carta por Categorías */}
      <main className="py-16">
        <div className="max-w-5xl mx-auto px-6">
          {data.categories.map((category, catIdx) => (
            <div key={catIdx} className="mb-16 last:mb-0">
              <h2 className="text-2xl font-bold text-slate-800 mb-8 border-b-2 border-amber-500 pb-2 inline-block">{category.name}</h2>
              <div className="space-y-4">
                {category.items.map((item, i) => (
                  <div key={i} className="flex flex-col md:flex-row md:items-center justify-between p-5 bg-white rounded-xl border border-slate-100 hover:shadow-md transition-all group">
                    <div className="flex items-center gap-4 mb-4 md:mb-0">
                      <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">{item.name}</h3>
                        <p className="text-slate-500 text-sm">{item.desc}</p>
                      </div>
                    </div>
                    <span className="text-xl font-bold text-slate-900 bg-amber-50 px-4 py-2 rounded-lg shrink-0 ml-20 md:ml-0">{item.price}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );

  return (
    <>
      {/* Botón Flotante - Vuelve a #demos */}
      <button
        onClick={handleBack}
        className="fixed top-6 left-6 z-50 bg-violet-600 text-white px-5 py-2.5 rounded-full font-medium shadow-lg flex items-center gap-2 hover:bg-violet-700 hover:scale-105 transition-all"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
        Volver a AlquilaWeb
      </button>

      {/* Renderizado Condicional de Plantillas */}
      {data.template === 'elegant' && renderElegant()}
      {data.template === 'playful' && renderPlayful()}
      {data.template === 'minimalist' && renderMinimalist()}

      {/* Footer Global */}
      <footer className={`${data.theme} text-white py-12 text-center relative z-20`}>
        <p className="font-medium text-lg">© 2026 {data.name}</p>
        <p className="text-sm opacity-70 mt-2">Sitio web demo generado por AlquilaWeb</p>
      </footer>
    </>
  );
}
