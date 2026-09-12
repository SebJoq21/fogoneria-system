import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import ModulesView from '../components/ModulesView'
import MenuPreview from '../components/MenuPreview'
import MenuEditor from '../components/MenuEditor'
import SupportView from '../components/SupportView'
import PaymentsView from '../components/PaymentsView'
import SettingsView from '../components/SettingsView'
import {
  CreditCard,
  Layers,
  LifeBuoy,
  Monitor,
  Puzzle,
  ChevronDown,
  Globe,
  Check,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
} from 'recharts'

// ─── Mock data per domain ────────────────────────────────────────────────────
const initialDomains = [
  {
    id: 'dom-1',
    name: 'www.mirestaurante.com',
    plan: 'profesional',
    status: 'active',
    activeModules: [],
    paymentHistory: [
      { id: 1, date: '01 Ago 2026', concept: 'Plan Profesional - Mensualidad', amount: '$70.00', status: 'Pagado', type: 'plan', day: 1 },
    ],
    metrics: {
      visitas: { total: 1245, change: '+12%', data: [{ name: 'Lun', v: 800 }, { name: 'Mar', v: 950 }, { name: 'Mié', v: 1100 }, { name: 'Jue', v: 1050 }, { name: 'Vie', v: 1245 }] },
      qr: { total: 850, change: '+8%', data: [{ name: 'Lun', v: 400 }, { name: 'Mar', v: 300 }, { name: 'Mié', v: 550 }, { name: 'Jue', v: 700 }, { name: 'Vie', v: 850 }] },
      reservas: { total: 112, change: '+5%', data: [{ name: 'Lun', v: 50 }, { name: 'Mar', v: 65 }, { name: 'Mié', v: 80 }, { name: 'Jue', v: 95 }, { name: 'Vie', v: 112 }] },
      whatsapp: { total: 45, change: '+15%', data: [{ name: 'Lun', v: 15 }, { name: 'Mar', v: 20 }, { name: 'Mié', v: 28 }, { name: 'Jue', v: 35 }, { name: 'Vie', v: 45 }] },
    },
  },
  {
    id: 'dom-2',
    name: 'www.cafelima.pe',
    plan: 'basico',
    status: 'active',
    activeModules: ['reservas'],
    paymentHistory: [
      { id: 10, date: '15 Jul 2026', concept: 'Plan Básico - Mensualidad', amount: '$40.00', status: 'Pagado', type: 'plan', day: 15 },
      { id: 11, date: '15 Jul 2026', concept: 'Módulo: Gestión de Reservas', amount: '$15.00', status: 'Pagado', type: 'module', day: 15 },
    ],
    metrics: {
      visitas: { total: 680, change: '+9%', data: [{ name: 'Lun', v: 300 }, { name: 'Mar', v: 420 }, { name: 'Mié', v: 510 }, { name: 'Jue', v: 590 }, { name: 'Vie', v: 680 }] },
      qr: { total: 320, change: '+5%', data: [{ name: 'Lun', v: 150 }, { name: 'Mar', v: 200 }, { name: 'Mié', v: 260 }, { name: 'Jue', v: 290 }, { name: 'Vie', v: 320 }] },
      reservas: { total: 78, change: '+12%', data: [{ name: 'Lun', v: 30 }, { name: 'Mar', v: 45 }, { name: 'Mié', v: 55 }, { name: 'Jue', v: 68 }, { name: 'Vie', v: 78 }] },
      whatsapp: { total: 22, change: '+10%', data: [{ name: 'Lun', v: 8 }, { name: 'Mar', v: 12 }, { name: 'Mié', v: 16 }, { name: 'Jue', v: 19 }, { name: 'Vie', v: 22 }] },
    },
  },
]

const initialMenuData = [
  { id: 1, name: 'Ceviche Clásico', description: 'Pesca del día marinada en limón sutil, ají limo, cebolla roja y culantro. Acompañado de choclo y camote.', price: '15.00', category: 'Entradas', image: 'https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=600&q=80', status: 'Activo' },
  { id: 2, name: 'Tequeños de Lomo', description: 'Masa crujiente rellena de nuestro clásico lomo saltado, acompañados de salsa huancaína.', price: '8.00', category: 'Entradas', image: 'https://images.unsplash.com/photo-1541529086526-db283c563270?auto=format&fit=crop&w=600&q=80', status: 'Activo' },
  { id: 3, name: 'Lomo Saltado', description: 'Trozos de lomo fino salteados al wok con cebolla, tomate, ají amarillo y sillao. Servido con papas fritas y arroz.', price: '22.00', category: 'Fondos', image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=600&q=80', status: 'Activo' },
  { id: 4, name: 'Ají de Gallina', description: 'Cremoso guiso de pechuga de pollo deshilachada con ají amarillo, pecanas y queso parmesano.', price: '18.00', category: 'Fondos', image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80', status: 'Activo' },
  { id: 5, name: 'Pisco Sour', description: 'Nuestro cóctel bandera. Pisco Quebranta, zumo de limón, jarabe de goma, clara de huevo y amargo de Angostura.', price: '10.00', category: 'Bebidas', image: 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=600&q=80', status: 'Activo' },
  { id: 6, name: 'Chicha Morada', description: 'Refrescante bebida tradicional a base de maíz morado, piña, manzana, canela y clavo de olor.', price: '4.00', category: 'Bebidas', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', status: 'Activo' },
]

const initialTickets = [
  { id: '#TK-0012', subject: 'Actualizar menú de temporada', status: 'En proceso', updated: 'Hoy, 10:30 AM' },
  { id: '#TK-0008', subject: 'Duda sobre reservas', status: 'Resuelto', updated: 'Hace 2 días' },
]

// ─── PlanModal ───────────────────────────────────────────────────────────────
function PlanModal({ onClose, onContinue, currentPlan, selectedPlan, setSelectedPlan }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-[scaleUp_0.2s_ease-out]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">Gestiona tu suscripción</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6 md:p-8">
          <p className="text-slate-600 mb-6">Selecciona el plan que mejor se adapte a las necesidades actuales de tu restaurante.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div onClick={() => setSelectedPlan('basico')} className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all ${selectedPlan === 'basico' ? 'border-indigo-600 bg-indigo-50/10' : 'border-slate-200 hover:border-indigo-300'}`}>
              {currentPlan === 'basico' && <span className="absolute -top-3 left-4 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">Plan Actual</span>}
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-slate-900">Plan Básico</h4>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPlan === 'basico' ? 'border-indigo-600' : 'border-slate-300'}`}>
                  {selectedPlan === 'basico' && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>}
                </div>
              </div>
              <div className="mb-3"><span className="text-2xl font-black text-slate-900">$40</span><span className="text-sm text-slate-500">/mes</span></div>
              <p className="text-sm text-slate-600">Carta digital QR sin sitio web completo. Ideal para locales pequeños.</p>
            </div>
            <div onClick={() => setSelectedPlan('profesional')} className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all ${selectedPlan === 'profesional' ? 'border-indigo-600 bg-indigo-50/10' : 'border-slate-200 hover:border-indigo-300'}`}>
              {currentPlan === 'profesional' && <span className="absolute -top-3 left-4 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">Plan Actual</span>}
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-slate-900">Plan Profesional</h4>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPlan === 'profesional' ? 'border-indigo-600' : 'border-slate-300'}`}>
                  {selectedPlan === 'profesional' && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>}
                </div>
              </div>
              <div className="mb-3"><span className="text-2xl font-black text-slate-900">$70</span><span className="text-sm text-slate-500">/mes</span></div>
              <p className="text-sm text-slate-600">Landing page completa, dominio propio y gestión por nuestro equipo.</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 p-6 flex flex-col sm:flex-row justify-end items-center gap-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-700 font-medium px-4 py-2 w-full sm:w-auto text-center cursor-pointer">Cancelar</button>
          <button type="button" disabled={selectedPlan === currentPlan} onClick={onContinue} className={`px-6 py-2.5 rounded-lg font-medium transition-all w-full sm:w-auto ${selectedPlan === currentPlan ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm cursor-pointer'}`}>
            {selectedPlan === currentPlan ? 'Plan Actual' : 'Continuar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SecurityModal ───────────────────────────────────────────────────────────
function SecurityModal({ authStep, setAuthStep, selectedPlan, onConfirmPlanChange, setShowSecurityModal }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]" onClick={() => { setShowSecurityModal(false); setAuthStep(1) }}>
      <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl overflow-hidden animate-[scaleUp_0.2s_ease-out]" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            Verificación de Seguridad
          </h3>
          <button onClick={() => { setShowSecurityModal(false); setAuthStep(1) }} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <div className="p-6">
          <div className="bg-indigo-50 border border-indigo-100 text-indigo-800 text-sm p-4 rounded-xl mb-6">
            Estás a punto de cambiar al <strong>Plan {selectedPlan === 'basico' ? 'Básico' : 'Profesional'}</strong>. Para autorizar este cambio en la facturación, necesitamos validar tu identidad.
          </div>
          <div className="space-y-4">
            {authStep === 1 ? (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Contraseña de administrador</label>
                <input type="password" placeholder="Ingresa tu contraseña para continuar" className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
              </div>
            ) : (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <label className="block text-sm font-semibold text-slate-700 mb-1 flex justify-between">
                  Código de verificación
                  <span className="text-xs text-indigo-600 cursor-pointer hover:underline">Reenviar código</span>
                </label>
                <p className="text-xs text-slate-500 mb-3">Contraseña verificada. Te hemos enviado un código de 6 dígitos al correo de la empresa.</p>
                <input type="text" placeholder="0 0 0 0 0 0" maxLength="6" className="w-full px-4 py-3 rounded-lg border border-slate-300 text-center tracking-[0.5em] font-mono text-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
              </div>
            )}
          </div>
        </div>
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={() => { setShowSecurityModal(false); setAuthStep(1) }} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
          {authStep === 1 ? (
            <button onClick={() => setAuthStep(2)} className="px-5 py-2.5 text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 rounded-lg transition-colors shadow-sm">Verificar contraseña</button>
          ) : (
            <button onClick={onConfirmPlanChange} className="px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors shadow-sm">Autorizar y Cambiar Plan</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar({ activeTab, onTabChange, activeModules, domains, selectedDomainId, onSelectDomain, onAddDomain }) {
  const [domainMenuOpen, setDomainMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const selectedDomain = domains.find(d => d.id === selectedDomainId)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setDomainMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const items = [
    { id: 'servicio', label: 'Tus servicios', icon: Monitor },
    { id: 'pagos', label: 'Pagos', icon: CreditCard },
  ]

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
      {/* Brand */}
      <div className="p-6 border-b border-slate-100">
        <span className="flex items-center gap-2 text-xl font-black tracking-tighter text-slate-900">
          <Layers className="w-5 h-5 text-indigo-600" />
          AlquilaWeb
        </span>
      </div>

      {/* Domain Selector */}
      <div className="px-4 pt-4 pb-2" ref={menuRef}>
        <button
          type="button"
          onClick={() => setDomainMenuOpen(!domainMenuOpen)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 bg-slate-50 hover:bg-white transition-all text-left group"
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <Globe className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dominio activo</p>
            <p className="text-sm font-semibold text-slate-800 truncate">{selectedDomain?.name || 'Seleccionar'}</p>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${domainMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {domainMenuOpen && (
          <div className="absolute left-4 right-4 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 animate-[fadeIn_0.1s_ease-out]">
            {domains.map((domain) => (
              <button
                key={domain.id}
                type="button"
                onClick={() => { onSelectDomain(domain.id); setDomainMenuOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors flex items-center gap-3"
              >
                <Globe className="w-4 h-4 text-slate-400" />
                <span className="flex-1 truncate text-slate-700">{domain.name}</span>
                {domain.id === selectedDomainId && <Check className="w-4 h-4 text-indigo-600" />}
              </button>
            ))}
            <div className="border-t border-slate-100 my-1"></div>
            <button
              type="button"
              onClick={() => { setDomainMenuOpen(false); onAddDomain() }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 transition-colors flex items-center gap-3 text-indigo-600 font-medium"
            >
              <span className="w-4 h-4 flex items-center justify-center text-lg leading-none">+</span>
              Agregar Dominio
            </button>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-2">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button key={item.id} type="button" onClick={() => onTabChange(item.id)} className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700 font-medium cursor-pointer' : 'text-slate-600 hover:bg-slate-50 cursor-pointer'}`}>
              <Icon className="w-5 h-5 mr-3" />
              {item.label}
            </button>
          )
        })}
        {activeModules.includes('reservas') && (
          <button type="button" onClick={() => onTabChange('modulos')} className="w-full text-left flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            Gestión de Reservas
          </button>
        )}
        {activeModules.includes('inventario') && (
          <button type="button" onClick={() => onTabChange('modulos')} className="w-full text-left flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
            Inventarios
          </button>
        )}
      </nav>

      {/* Bottom */}
      <div className="mt-auto p-4 border-t border-slate-100 flex flex-col gap-2">
        <button type="button" onClick={() => onTabChange('modulos')} className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'modulos' ? 'bg-indigo-50 text-indigo-700 font-medium cursor-pointer' : 'text-slate-600 hover:bg-slate-50 cursor-pointer'}`}>
          <Puzzle className="w-5 h-5" />
          <span className="font-medium text-sm">Añadir Módulos</span>
        </button>
        <button type="button" onClick={() => onTabChange('soporte')} className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'soporte' ? 'bg-indigo-50 text-indigo-700 font-medium cursor-pointer' : 'text-slate-600 hover:bg-slate-50 cursor-pointer'}`}>
          <LifeBuoy className="w-5 h-5" />
          <span className="font-medium text-sm">Soporte Técnico</span>
        </button>
      </div>
    </aside>
  )
}

// ─── TopBar ──────────────────────────────────────────────────────────────────
function TopBar({ activeTab, setActiveTab, notifications, hasUnread, showNotifMenu, setShowNotifMenu, setHasUnread, accountName }) {
  const titles = {
    servicio: 'Resumen de tu servicio',
    pagos: 'Gestión de pagos',
    soporte: 'Soporte Técnico',
    modulos: 'Módulos y Mejoras',
    'ver-carta': 'Carta Digital y Menú',
    'editor-carta': 'Editor de Menú',
    configuracion: 'Configuración de la cuenta',
  }
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [tick, setTick] = useState(0)
  const navigate = useNavigate()
  const notifRef = useRef(null)

  useEffect(() => { const timer = setInterval(() => setTick(t => t + 1), 60000); return () => clearInterval(timer) }, [])

  const getTimeAgo = (timestamp) => {
    void tick
    if (!timestamp) return 'Justo ahora'
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return 'Justo ahora'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `Hace ${minutes} min`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `Hace ${hours} h`
    return `Hace ${Math.floor(hours / 24)} d`
  }

  useEffect(() => {
    const handleClickOutside = (event) => { if (notifRef.current && !notifRef.current.contains(event.target)) setShowNotifMenu(false) }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [setShowNotifMenu])

  return (
    <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8">
      <h1 className="text-xl font-bold text-slate-900">{titles[activeTab]}</h1>
      <div className="flex items-center gap-4">
        <div className="relative" ref={notifRef}>
          <button type="button" onClick={() => { setShowNotifMenu(!showNotifMenu); setHasUnread(false) }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors relative cursor-pointer">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
            {hasUnread && <span className="absolute top-1 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>}
          </button>
          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-[fadeIn_0.2s_ease-out]">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h4 className="font-bold text-slate-800">Notificaciones</h4>
              </div>
              <div className="max-h-80 overflow-y-auto no-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">No tienes notificaciones nuevas.</div>
                ) : (
                  notifications.map((notif) => (
                    <div key={notif.id} className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <p className="text-sm font-semibold text-slate-900 mb-1">{notif.title}</p>
                      <p className="text-xs text-slate-600 leading-relaxed mb-2">{notif.message}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{getTimeAgo(notif.timestamp)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <div onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition-colors select-none">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">MR</div>
            <span className="text-sm font-medium text-slate-700 hidden sm:block">{accountName}</span>
            <svg className={`w-4 h-4 text-slate-400 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </div>
          {isProfileMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 animate-[fadeIn_0.1s_ease-out]">
              <button type="button" className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors" onClick={() => { setIsProfileMenuOpen(false); setActiveTab('configuracion') }}>Configuración</button>
              <div className="border-t border-slate-100 my-1" />
              <button type="button" className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2" onClick={() => { setIsProfileMenuOpen(false); navigate('/') }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

// ─── ServiceView ─────────────────────────────────────────────────────────────
function ServiceView({ activePlan, onChangePlan, onViewMenu, domain }) {
  const metrics = domain?.metrics
  const isPending = domain?.status === 'pending'

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-[fadeIn_0.4s_ease-out]">
        <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-6 shadow-inner border border-amber-100">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-3">En espera de confirmación</h2>
        <p className="text-slate-500 max-w-md mb-2 text-lg">
          Tu dominio <strong className="text-slate-700">{domain?.name}</strong> está siendo revisado por nuestro equipo técnico.
        </p>
        <p className="text-slate-400 text-sm">
          Te notificaremos por correo electrónico cuando tu sitio web esté listo. Esto generalmente toma 24-48 horas hábiles.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl border-2 border-indigo-50 shadow-md hover:shadow-lg hover:-translate-y-1 hover:border-indigo-100 transition-all duration-300 p-6 flex flex-col justify-center group">
          <div className="flex justify-between items-start mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100/50 group-hover:bg-indigo-100 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
              </div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Dominio Principal</h3>
            </div>
            <span className="bg-emerald-50 text-emerald-600 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-emerald-100">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Activo
            </span>
          </div>
          <a href={`https://${domain?.name}`} target="_blank" rel="noreferrer" className="text-xl sm:text-2xl font-black text-slate-900 hover:text-indigo-600 transition-colors flex items-center gap-2 w-max">
            {domain?.name}
            <svg className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
          </a>
        </div>
        <div className="bg-white rounded-2xl border-2 border-slate-100 shadow-md hover:shadow-lg hover:-translate-y-1 hover:border-slate-200 transition-all duration-300 p-6 flex flex-col justify-center group">
          <div className="flex justify-between items-start mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center border border-orange-100/50 group-hover:bg-orange-100 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg>
              </div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Plan Actual</h3>
            </div>
            <span className="bg-slate-50 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-full border border-slate-200">Facturación Mensual</span>
          </div>
          <div className="flex justify-between items-end">
            <p className="text-xl sm:text-2xl font-black text-slate-900 capitalize">{activePlan}</p>
            <button type="button" onClick={onChangePlan} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-indigo-600/30 hover:decoration-indigo-600 underline-offset-4 cursor-pointer">Cambiar plan</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between shadow-sm overflow-hidden group">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-500 mb-2">Visitas Totales</h3>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-black text-slate-900">{metrics?.visitas.total.toLocaleString()}</span>
              <span className="text-sm font-bold text-green-500 mb-1">{metrics?.visitas.change} este mes</span>
            </div>
          </div>
          <div className="h-24 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics?.visitas.data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVisitas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={10} />
                <Area type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorVisitas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between shadow-sm overflow-hidden group">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-500 mb-2">Escaneos QR en mesa</h3>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-black text-slate-900">{metrics?.qr.total.toLocaleString()}</span>
              <span className="text-sm font-bold text-green-500 mb-1">{metrics?.qr.change} este mes</span>
            </div>
          </div>
          <div className="h-24 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics?.qr.data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={10} />
                <Bar dataKey="v" fill="#14b8a6" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between shadow-sm overflow-hidden group">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-500 mb-2">Clics en Reservar</h3>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-black text-slate-900">{metrics?.reservas.total.toLocaleString()}</span>
              <span className="text-sm font-bold text-green-500 mb-1">{metrics?.reservas.change} este mes</span>
            </div>
          </div>
          <div className="h-24 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics?.reservas.data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={10} />
                <Line type="monotone" dataKey="v" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3, fill: "#f59e0b", strokeWidth: 2, stroke: "#fff" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between shadow-sm overflow-hidden group">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-500 mb-2">Clics a WhatsApp</h3>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-black text-slate-900">{metrics?.whatsapp.total.toLocaleString()}</span>
              <span className="text-sm font-bold text-green-500 mb-1">{metrics?.whatsapp.change} este mes</span>
            </div>
          </div>
          <div className="h-24 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics?.whatsapp.data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={10} />
                <Line type="monotone" dataKey="v" stroke="#10b981" strokeWidth={3} dot={{ r: 3, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-6 animate-[fadeIn_0.5s_ease-out]">
        <div className="flex items-center gap-5 w-full lg:w-auto">
          <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center shrink-0 border border-orange-100">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 mb-1">Carta Digital y Menú</h3>
            <p className="text-sm text-slate-500 mb-3 line-clamp-1 md:line-clamp-none">Administra tus categorías, platos, precios y disponibilidad en tiempo real.</p>
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
              <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md"><span className="w-2 h-2 rounded-full bg-green-500"></span> 42 Platos activos</span>
              <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> 8 Categorías</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0 mt-4 lg:mt-0">
          <button onClick={onViewMenu} className="px-6 py-2.5 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:border-indigo-600 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
            Ver carta
          </button>
        </div>
      </div>
    </>
  )
}

// ─── ClientDashboard ─────────────────────────────────────────────────────────
function ClientDashboard() {
  const [domains, setDomains] = useState(initialDomains)
  const [selectedDomainId, setSelectedDomainId] = useState(initialDomains[0].id)
  const [activeTab, setActiveTab] = useState('servicio')
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('profesional')
  const [notifications, setNotifications] = useState([])
  const [hasUnread, setHasUnread] = useState(false)
  const [showNotifMenu, setShowNotifMenu] = useState(false)
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [authStep, setAuthStep] = useState(1)
  const [menuItems, setMenuItems] = useState(initialMenuData)
  const [tickets, setTickets] = useState(initialTickets)
  const [accountName, setAccountName] = useState('Mi Restaurante S.A.C.')
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (location.state?.newDomain) {
      const newDomain = location.state.newDomain
      setDomains(prev => [...prev, newDomain])
      setSelectedDomainId(newDomain.id)
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  const selectedDomain = domains.find(d => d.id === selectedDomainId)
  const activePlan = selectedDomain?.plan || 'basico'
  const activeModules = selectedDomain?.activeModules || []
  const paymentHistory = selectedDomain?.paymentHistory || []

  const updateDomain = (domainId, updates) => {
    setDomains(prev => prev.map(d => d.id === domainId ? { ...d, ...updates } : d))
  }

  const addNotification = (title, message) => {
    const newNotif = { id: Date.now(), title, message, timestamp: Date.now() }
    setNotifications(prev => [newNotif, ...prev])
    setHasUnread(true)
  }

  const handleActivateModule = (moduleData) => {
    const cleanPrice = moduleData.price.replace('+', '').replace('/mes', '')
    const today = new Date()
    const newPayment = {
      id: Date.now(),
      date: today.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
      concept: `Módulo: ${moduleData.title}`,
      amount: cleanPrice,
      status: 'Pagado',
      type: 'module',
      day: today.getDate()
    }
    updateDomain(selectedDomainId, {
      activeModules: [...activeModules, moduleData.id],
      paymentHistory: [newPayment, ...paymentHistory],
    })
    addNotification('Nuevo módulo activado', `El módulo "${moduleData.title}" ha sido añadido a tu cuenta.`)
  }

  const handleRequestUpgrade = () => {
    setSelectedPlan('profesional')
    setIsPlanModalOpen(true)
    setShowSecurityModal(false)
  }

  const handleCreateProposal = (proposalData) => {
    const newTicket = { id: `#TK-${Math.floor(Math.random() * 9000) + 1000}`, subject: `Propuesta: ${proposalData.title}`, status: 'Enviado', updated: 'Justo ahora' }
    setTickets([newTicket, ...tickets])
    addNotification('Propuesta enviada con éxito', `Tu idea "${proposalData.title}" ha sido recibida. Nuestro equipo la evaluará y te contactará por el ticket generado.`)
    setActiveTab('soporte')
  }

  const handleConfirmPlanChange = () => {
    const today = new Date()
    const amount = selectedPlan === 'basico' ? '$40.00' : '$70.00'
    const newPayment = {
      id: Date.now(),
      date: today.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
      concept: `Cambio a Plan ${selectedPlan === 'basico' ? 'Básico' : 'Profesional'}`,
      amount,
      status: 'Pagado',
      type: 'plan',
      day: today.getDate()
    }
    updateDomain(selectedDomainId, {
      plan: selectedPlan,
      paymentHistory: [newPayment, ...paymentHistory],
    })
    addNotification('Plan actualizado con éxito', `Has cambiado al Plan ${selectedPlan === 'basico' ? 'Básico' : 'Profesional'}.`)
    setShowSecurityModal(false)
    setIsPlanModalOpen(false)
    setAuthStep(1)
    setActiveTab('servicio')
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeModules={activeModules}
        domains={domains}
        selectedDomainId={selectedDomainId}
        onSelectDomain={setSelectedDomainId}
        onAddDomain={() => navigate('/onboarding?mode=addDomain')}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          notifications={notifications}
          hasUnread={hasUnread}
          showNotifMenu={showNotifMenu}
          setShowNotifMenu={setShowNotifMenu}
          setHasUnread={setHasUnread}
          accountName={accountName}
        />
        <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
          {activeTab === 'servicio' && (
            <ServiceView activePlan={activePlan} onChangePlan={() => setIsPlanModalOpen(true)} onViewMenu={() => setActiveTab('ver-carta')} domain={selectedDomain} />
          )}
          {activeTab === 'ver-carta' && (
            <MenuPreview menuItems={menuItems} onBack={() => setActiveTab('servicio')} onEditMenu={() => setActiveTab('editor-carta')} />
          )}
          {activeTab === 'editor-carta' && (
            <MenuEditor menuItems={menuItems} setMenuItems={setMenuItems} onBack={() => setActiveTab('ver-carta')} onNotify={addNotification} />
          )}
          {activeTab === 'pagos' && (
            <PaymentsView paymentHistory={paymentHistory} domainName={selectedDomain?.name} />
          )}
          {activeTab === 'soporte' && (
            <SupportView tickets={tickets} setTickets={setTickets} onNotify={addNotification} />
          )}
          {activeTab === 'configuracion' && (
            <SettingsView onNotify={addNotification} domainId={selectedDomainId} domainName={selectedDomain?.name} accountName={accountName} setAccountName={setAccountName} />
          )}
          {activeTab === 'modulos' && (
            <ModulesView
              activeModules={activeModules}
              onActivateModule={handleActivateModule}
              activePlan={activePlan}
              onRequestUpgrade={handleRequestUpgrade}
              onCreateProposal={handleCreateProposal}
            />
          )}
        </div>
      </div>

      {isPlanModalOpen && (
        <PlanModal
          currentPlan={activePlan}
          selectedPlan={selectedPlan}
          setSelectedPlan={setSelectedPlan}
          onContinue={() => { setIsPlanModalOpen(false); setShowSecurityModal(true); setAuthStep(1) }}
          onClose={() => { setShowSecurityModal(false); setAuthStep(1); setIsPlanModalOpen(false) }}
        />
      )}
      {showSecurityModal && (
        <SecurityModal
          authStep={authStep}
          setAuthStep={setAuthStep}
          selectedPlan={selectedPlan}
          onConfirmPlanChange={handleConfirmPlanChange}
          setShowSecurityModal={setShowSecurityModal}
        />
      )}
    </div>
  )
}

export default ClientDashboard
