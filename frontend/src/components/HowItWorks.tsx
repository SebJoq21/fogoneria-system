import { UserPlus, CreditCard, MessageSquare, Rocket } from 'lucide-react'

const steps = [
  {
    number: '01',
    title: 'Registrate',
    description: 'Crea tu cuenta en menos de 2 minutos con el nombre de tu restaurante.',
    icon: <UserPlus className="w-6 h-6 text-violet-400" />
  },
  {
    number: '02',
    title: 'Abona 50%',
    description: 'Con el primer pago iniciamos el diseño de tu sitio web y carta digital.',
    icon: <CreditCard className="w-6 h-6 text-violet-400" />
  },
  {
    number: '03',
    title: 'Feedback',
    description: 'Revisamos juntos colores, fotos y menú. Tú decides cómo se ve.',
    icon: <MessageSquare className="w-6 h-6 text-violet-400" />
  },
  {
    number: '04',
    title: 'Lanzamiento',
    description: 'Publicamos tu web, configuramos el dominio y quedas listo para recibir clientes.',
    icon: <Rocket className="w-6 h-6 text-violet-400" />
  }
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="min-h-screen flex items-center py-24 bg-[#0F172A] relative overflow-hidden">
      {/* Elemento decorativo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-violet-600/15 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">

        {/* Encabezado */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4 font-heading">
            Lanza tu web en <span className="text-violet-400">4 simples pasos</span>
          </h2>
          <p className="text-lg text-slate-400">
            Sin conocimientos técnicos. Sin dolores de cabeza.
          </p>
        </div>

        {/* Grid de Pasos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-[#1E293B] border border-white/10 rounded-2xl p-8 hover:bg-[#253349] transition-all duration-300 group relative overflow-hidden"
            >
              {/* Número grande con gradiente */}
              <span className="text-7xl font-extrabold bg-gradient-to-br from-violet-400 to-violet-600 bg-clip-text text-transparent font-heading block mb-4 leading-none">
                {step.number}
              </span>

              {/* Icono */}
              <div className="w-12 h-12 bg-violet-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-violet-500/30 transition-colors">
                {step.icon}
              </div>

              {/* Contenido */}
              <h3 className="text-xl font-bold text-white mb-3 font-heading">{step.title}</h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
