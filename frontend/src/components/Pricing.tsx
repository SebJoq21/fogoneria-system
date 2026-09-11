import { Check } from 'lucide-react'

const plans = [
  {
    name: 'BÁSICO',
    price: '$30',
    originalPrice: '$40',
    period: '/mes',
    description: 'Ideal para empezar tu presencia online',
    features: [
      'Sitio web 1 página',
      'Carta digital QR',
      'Dominio incluido',
      'Hosting & mantenimiento',
      '1 actualización al mes',
      'Soporte por WhatsApp',
    ],
    highlighted: false,
    cta: 'Comenzar con Básico',
  },
  {
    name: 'PROFESIONAL',
    price: '$65',
    originalPrice: '$80',
    period: '/mes',
    description: 'Para restaurantes con ambición de crecer',
    features: [
      'Todo lo del plan Básico',
      'Sitio web multipágina',
      'Sistema de reservas online',
      'Pedidos automáticos por WhatsApp',
      'Galería de fotos profesional',
      'Blog / Novedades',
      'Actualizaciones ilimitadas',
      'Soporte prioritario 24/7',
    ],
    highlighted: true,
    cta: 'Comenzar con Profesional',
  },
  {
    name: 'AÑADIDOS',
    price: '+$25',
    originalPrice: null,
    period: '/módulo',
    description: 'Personaliza tu plan con funciones extra',
    features: [
      'Sistema de delivery propio',
      'Integración Rappi / PedidosYa',
      'Tienda online (e-commerce)',
      'Pasarela de pagos en línea',
      'Módulo de fidelización',
      'Estadísticas avanzadas',
    ],
    highlighted: false,
    cta: 'Personalizar plan',
  },
]

export default function Pricing({ onRegister }) {
  return (
    <section id="pricing" className="min-h-screen flex items-center py-24 bg-[#FAFAF8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">

        {/* Encabezado */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold text-[#0F172A] mb-4 font-heading">
            Elige el plan ideal para tu negocio
          </h2>
          <p className="text-lg text-[#64748B]">
            Sin sorpresas. Sin contratos largos. Cancela cuando quieras.
          </p>
        </div>

        {/* Grid de Planes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-8 flex flex-col ${
                plan.highlighted
                  ? 'bg-violet-600 text-white shadow-2xl shadow-violet-500/25 md:scale-105 z-10'
                  : 'bg-white border border-slate-200'
              }`}
            >
              {/* Badge "MÁS POPULAR" */}
              {plan.highlighted && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-[#0F172A] px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                  MÁS POPULAR
                </span>
              )}

              {/* Nombre del plan */}
              <h3 className={`text-sm font-bold tracking-wider mb-2 ${
                plan.highlighted ? 'text-violet-200' : 'text-[#64748B]'
              }`}>
                {plan.name}
              </h3>

              {/* Precio */}
              <div className="flex items-baseline gap-2 mb-2">
                <span className={`text-5xl font-extrabold font-heading ${
                  plan.highlighted ? 'text-white' : 'text-[#0F172A]'
                }`}>
                  {plan.price}
                </span>
                {plan.originalPrice && (
                  <span className={`text-lg line-through ${
                    plan.highlighted ? 'text-violet-300' : 'text-[#64748B]'
                  }`}>
                    {plan.originalPrice}
                  </span>
                )}
                <span className={`text-sm ${
                  plan.highlighted ? 'text-violet-200' : 'text-[#64748B]'
                }`}>
                  {plan.period}
                </span>
              </div>

              {/* Descripción */}
              <p className={`text-sm mb-8 ${
                plan.highlighted ? 'text-violet-200' : 'text-[#64748B]'
              }`}>
                {plan.description}
              </p>

              {/* Features */}
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className={`w-5 h-5 shrink-0 mt-0.5 ${
                      plan.highlighted ? 'text-white' : 'text-violet-600'
                    }`} />
                    <span className={`text-sm ${
                      plan.highlighted ? 'text-white' : 'text-[#0F172A]'
                    }`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                type="button"
                onClick={onRegister}
                className={`w-full py-3.5 rounded-xl font-semibold transition-all duration-200 cursor-pointer ${
                  plan.highlighted
                    ? 'bg-white text-violet-600 hover:bg-violet-50'
                    : 'bg-white text-violet-600 border-2 border-violet-600 hover:bg-violet-50'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Nota */}
        <p className="text-center text-[#64748B] text-sm mt-12">
          ¿Tienes dudas? <a href="#" className="text-violet-600 font-semibold hover:underline">Escríbenos por WhatsApp</a> y te ayudamos.
        </p>

      </div>
    </section>
  )
}
