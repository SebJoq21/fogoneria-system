import { useState, useEffect, useRef } from 'react'
import { Star } from 'lucide-react'

const reviews = [
  {
    id: 1,
    name: 'Carlos Mendoza',
    role: 'Propietario · La Cevichería del Puerto',
    image: 'https://i.pravatar.cc/150?img=11',
    quote: 'En menos de una semana ya teníamos nuestra web y carta digital. Las reservas online aumentaron un 40% en el primer mes.',
    rating: 5,
  },
  {
    id: 2,
    name: 'María Elena Quispe',
    role: 'Dueña · Dulcería La Limeña',
    image: 'https://i.pravatar.cc/150?img=5',
    quote: 'Pensé que tener una web era carísimo. AlquilaWeb me demostró lo contrario. Mi catálogo de postres ahora llega a toda Lima.',
    rating: 5,
  },
  {
    id: 3,
    name: 'Jorge Ramos',
    role: 'Gerente · Café Central',
    image: 'https://i.pravatar.cc/150?img=12',
    quote: 'El soporte es increíble. Cualquier cambio en el menú lo hacen el mismo día. Mi local ahora aparece en Google y eso vale oro.',
    rating: 5,
  },
  {
    id: 4,
    name: 'Ana Torres',
    role: 'Chef · La Estancia Criolla',
    image: 'https://i.pravatar.cc/150?img=9',
    quote: 'Mis clientes ahora pueden ver el menú completo con fotos antes de llegar. Las reservas se triplicaron en menos de un mes.',
    rating: 5,
  },
  {
    id: 5,
    name: 'Roberto Sánchez',
    role: 'Gerente · Sushi House',
    image: 'https://i.pravatar.cc/150?img=8',
    quote: 'La integración con WhatsApp fue lo mejor. Ahora confirmo pedidos automáticamente y ahorro horas de teléfono.',
    rating: 5,
  },
]

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5 mb-4">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`w-5 h-5 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
        />
      ))}
    </div>
  )
}

export default function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const intervalRef = useRef(null)

  // Duplicate reviews for seamless loop
  const allReviews = [...reviews, ...reviews]

  useEffect(() => {
    if (isPaused) return
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % reviews.length)
    }, 4000)
    return () => clearInterval(intervalRef.current)
  }, [isPaused])

  return (
    <section id="reviews" className="min-h-screen flex items-center py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">

        {/* Encabezado */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold text-[#0F172A] mb-4 font-heading">
            Lo que dicen nuestros clientes
          </h2>
          <p className="text-lg text-[#64748B]">
            Restaurantes reales que ya disfrutan de su presencia digital.
          </p>
        </div>

        {/* Carousel */}
        <div
          className="relative"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${currentIndex * (100 / 3)}%)` }}
            >
              {allReviews.map((review, index) => (
                <div
                  key={`${review.id}-${index}`}
                  className="w-full md:w-1/3 flex-shrink-0 px-4"
                >
                  <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 h-full">
                    <StarRating rating={review.rating} />

                    <blockquote className="text-[#0F172A] text-lg leading-relaxed mb-8">
                      &ldquo;{review.quote}&rdquo;
                    </blockquote>

                    <div className="flex items-center gap-4 mt-auto">
                      <img
                        src={review.image}
                        alt={`Foto de ${review.name}`}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-bold text-[#0F172A]">{review.name}</p>
                        <p className="text-sm text-[#64748B]">{review.role}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dots */}
          <div className="flex justify-center gap-2 mt-8">
            {reviews.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  currentIndex === i
                    ? 'bg-violet-600 w-8'
                    : 'bg-slate-300 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>
        </div>

      </div>
    </section>
  )
}
