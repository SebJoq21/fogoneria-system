import { Link } from 'react-router-dom'
import { ArrowRight, Utensils, Cake, Coffee } from 'lucide-react'

const demos = [
  {
    id: 1,
    title: 'Sentimiento Peruano',
    category: 'Comida criolla',
    description: 'Restaurante de tradición peruana con carta variada y reservas online.',
    image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80',
    menuHighlights: ['Ceviche clásico', 'Lomo saltado', 'Arroz con mariscos'],
    tags: ['Reservas', 'Carta QR'],
    link: '/demo/criolla',
    icon: <Utensils className="w-5 h-5" />,
    color: 'from-amber-500 to-orange-600'
  },
  {
    id: 2,
    title: 'Tu postre a la limeña',
    category: 'Repostería artesanal',
    description: 'Dulcería limeña con postres tradicionales y catálogo visual.',
    image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80',
    menuHighlights: ['Tres leches', 'Suspiro limeño', 'Alfajores'],
    tags: ['Catálogo', 'Pedidos'],
    link: '/demo/postres',
    icon: <Cake className="w-5 h-5" />,
    color: 'from-pink-500 to-rose-600'
  },
  {
    id: 3,
    title: 'Café Express',
    category: 'Cafetería y desayunos',
    description: 'Café de especialidad con carta digital y pedidos por WhatsApp.',
    image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80',
    menuHighlights: ['Flat white', 'Avocado toast', 'Brownie de chocolate'],
    tags: ['Menú Digital', 'Delivery'],
    link: '/demo/cafe',
    icon: <Coffee className="w-5 h-5" />,
    color: 'from-amber-600 to-yellow-700'
  }
]

export default function Portfolio() {
  return (
    <section id="demos" className="h-screen overflow-hidden bg-[#FAFAF8] flex flex-col">
      {/* Contenido centrado */}
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">

          {/* Encabezado */}
          <div className="text-center max-w-2xl mx-auto mb-6">
            <h2 className="text-3xl md:text-5xl font-extrabold text-[#0F172A] mb-4 font-heading">
              Sitios web que abren el apetito
            </h2>
            <p className="text-lg text-[#64748B]">
              Explora algunos de los sitios que hemos creado para restaurantes como el tuyo.
            </p>
          </div>

          {/* Grid de Demos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {demos.map((demo) => (
              <Link
                key={demo.id}
                to={demo.link}
                className="group block bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col"
              >
                {/* Imagen */}
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                  <img
                    src={demo.image}
                    alt={`Demo de ${demo.title}`}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t ${demo.color} opacity-0 group-hover:opacity-40 transition-opacity duration-300`} />
                  <div className="absolute top-4 left-4 flex gap-2">
                    {demo.tags.map(tag => (
                      <span key={tag} className="px-3 py-1 bg-[#0F172A]/80 backdrop-blur-sm text-white text-xs font-semibold rounded-lg">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className={`absolute bottom-4 right-4 w-10 h-10 bg-gradient-to-br ${demo.color} rounded-full flex items-center justify-center text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300`}>
                    {demo.icon}
                  </div>
                </div>

                {/* Contenido */}
                <div className="p-6 flex-1 flex flex-col">
                  <div className="mb-3">
                    <h3 className="text-xl font-bold text-[#0F172A] mb-1 group-hover:text-violet-600 transition-colors font-heading">
                      {demo.title}
                    </h3>
                    <p className="text-violet-600 text-sm font-medium">{demo.category}</p>
                  </div>

                  <p className="text-[#64748B] text-sm mb-4 leading-relaxed">
                    {demo.description}
                  </p>

                  {/* Highlights */}
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2">Platos destacados</p>
                    <div className="flex flex-wrap gap-1.5">
                      {demo.menuHighlights.map((item) => (
                        <span key={item} className="px-2.5 py-1 bg-[#FAFAF8] text-[#64748B] text-xs rounded-md border border-slate-100">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Botón */}
                  <div className="mt-auto pt-4 border-t border-slate-100">
                    <span className="flex items-center justify-center gap-2 w-full bg-[#0F172A] text-white font-semibold py-3 rounded-xl group-hover:bg-violet-600 transition-colors">
                      Ver demo
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}
