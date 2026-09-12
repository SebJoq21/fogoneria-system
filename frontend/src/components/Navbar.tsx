import { useState } from 'react'
import { Menu, X } from 'lucide-react'

export default function Navbar({ onLogin, onRegister }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-[#0F172A]/95 backdrop-blur-md border-b border-white/5 transition-all">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 flex justify-between items-center h-20">

        {/* Logo */}
        <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
          <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-violet-700 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </div>
          <span className="text-2xl font-extrabold text-white tracking-tight font-heading">AlquilaWeb</span>
        </div>

        {/* Nav Links - Desktop */}
        <div className="hidden md:flex items-center gap-10">
          <a href="#inicio" className="text-base font-medium text-slate-300 hover:text-white transition-colors">Inicio</a>
          <a href="#demos" className="text-base font-medium text-slate-300 hover:text-white transition-colors">Demos</a>
          <a href="#how-it-works" className="text-base font-medium text-slate-300 hover:text-white transition-colors">Cómo funciona</a>
          <a href="#reviews" className="text-base font-medium text-slate-300 hover:text-white transition-colors">Reseñas</a>
          <a href="#pricing" className="text-base font-medium text-slate-300 hover:text-white transition-colors">Precios</a>
        </div>

        {/* Action Buttons - Desktop */}
        <div className="hidden md:flex items-center gap-6">
          <button
            onClick={onLogin}
            className="text-base font-semibold text-slate-300 hover:text-white transition-colors"
          >
            Iniciar Sesión
          </button>
          <button
            onClick={onRegister}
            className="bg-violet-600 text-white text-base font-semibold px-7 py-2.5 rounded-full hover:bg-violet-700 hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-200"
          >
            Regístrate
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-white p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[#0F172A] border-t border-white/5 px-6 py-6">
          <div className="flex flex-col gap-4">
            <a href="#inicio" className="text-base font-medium text-slate-300 hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>Inicio</a>
            <a href="#demos" className="text-base font-medium text-slate-300 hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>Demos</a>
            <a href="#how-it-works" className="text-base font-medium text-slate-300 hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>Cómo funciona</a>
            <a href="#reviews" className="text-base font-medium text-slate-300 hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>Reseñas</a>
            <a href="#pricing" className="text-base font-medium text-slate-300 hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>Precios</a>
            <hr className="border-white/10" />
            <button onClick={() => { onLogin(); setMobileOpen(false); }} className="text-base font-semibold text-slate-300 hover:text-white transition-colors text-left">
              Iniciar Sesión
            </button>
            <button onClick={() => { onRegister(); setMobileOpen(false); }} className="bg-violet-600 text-white text-base font-semibold px-7 py-2.5 rounded-full hover:bg-violet-700 transition-all w-full">
              Regístrate
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
