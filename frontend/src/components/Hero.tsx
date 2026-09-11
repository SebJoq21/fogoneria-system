function Hero() {
  return (
    <section
      id="inicio"
      className="relative w-full h-screen min-h-[700px] flex items-center justify-center bg-[#0F172A]"
      style={{
        backgroundImage:
          'url("https://images.unsplash.com/photo-1555396273-367ea4eb4db5?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay oscuro con gradiente */}
      <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-[#0F172A]/95 via-[#0F172A]/80 to-[#0F172A]/95 z-0" />

      {/* Contenido centrado */}
      <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">

        {/* Headline */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.1] mb-6 tracking-tight font-heading">
          Tu restaurante{' '}
          <span className="text-violet-400">en internet,</span>
          <br />
          sin complicaciones.
        </h1>

        {/* Subtítulo */}
        <p className="text-lg md:text-xl text-slate-400 mb-10 leading-relaxed max-w-2xl mx-auto">
          Nosotros creamos, alojamos y mantenemos tu sitio web y carta digital
          mientras tú te enfocas en cocinar.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <a
            href="#pricing"
            className="bg-violet-600 text-white rounded-full px-8 py-3.5 font-semibold shadow-lg shadow-violet-500/25 hover:bg-violet-700 hover:shadow-violet-500/40 transition-all duration-300 inline-flex items-center justify-center gap-2"
          >
            Ver planes
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
          </a>
          <a
            href="#demos"
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm rounded-full px-8 py-3.5 font-semibold transition-all duration-300 inline-flex items-center justify-center"
          >
            Empezar ahora
          </a>
        </div>
      </div>
    </section>
  )
}

export default Hero
