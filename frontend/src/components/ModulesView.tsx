import React, { useState } from 'react'

const modulesCatalog = [
  {
    id: 'whatsapp',
    title: 'Automatización de WhatsApp',
    description: 'Envía recordatorios automáticos de reservas y confirmaciones de pedidos directamente al WhatsApp de tus clientes.',
    price: '+$25.00/mes',
    icon: <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>,
    iconBg: 'bg-emerald-100',
    features: [
      'Confirmaciones automáticas de reservas por WhatsApp',
      'Recordatorios de pedidos programados',
      'Mensajes personalizados con nombre del cliente',
      'Integración directa con tu sistema de reservas',
      'Historial de mensajes enviados',
    ],
    preview: {
      title: 'Vista previa del módulo',
      description: 'Este módulo se integra directamente con tu sistema de reservas para enviar notificaciones automáticas a tus clientes. Cuando un cliente hace una reserva, recibe un mensaje de confirmación al instante por WhatsApp.',
      steps: ['Cliente reserva una mesa online', 'El sistema envía confirmación por WhatsApp', '24h antes, recibe recordatorio automático', 'Si cancela, se notifica al restaurante'],
    },
  },
  {
    id: 'fidelizacion',
    title: 'Sistema de Fidelización',
    description: 'Crea cupones de descuento y acumulación de puntos para premiar a tus clientes más frecuentes.',
    price: '+$20.00/mes',
    icon: <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"></path></svg>,
    iconBg: 'bg-purple-100',
    features: [
      'Programa de puntos por cada visita o compra',
      'Cupones de descuento personalizados',
      'Recompensas por referidos',
      'Dashboard de clientes frecuentes',
      'Notificaciones de puntos acumulados',
    ],
    preview: {
      title: 'Vista previa del módulo',
      description: 'Crea un programa de lealtad que mantenga a tus clientes volviendo. El sistema automáticamente asigna puntos por cada visita y permite canjearlos por descuentos o platos gratis.',
      steps: ['Cliente se registra en tu programa', 'Acumula puntos por cada visita', 'Puede canjear puntos por descuentos', 'Recibe ofertas personalizadas'],
    },
  },
  {
    id: 'reservas',
    title: 'Gestión de Reservas',
    description: 'Permite a tus clientes reservar mesas online con confirmación instantánea y mapa interactivo del local.',
    price: '+$15.00/mes',
    icon: <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>,
    iconBg: 'bg-blue-100',
    features: [
      'Mapa interactivo del local para elegir mesa',
      'Confirmación instantánea por email y SMS',
      'Gestión de disponibilidad en tiempo real',
      'Lista de espera automática',
      'Reportes de ocupación por día/hora',
    ],
    preview: {
      title: 'Vista previa del módulo',
      description: 'Tus clientes podrán reservar mesas directamente desde tu sitio web. El sistema muestra un mapa interactivo del local donde pueden elegir la ubicación preferida.',
      steps: ['Cliente selecciona fecha y hora', 'Ve el mapa interactivo del local', 'Elige su mesa favorita', 'Recibe confirmación al instante'],
    },
  },
  {
    id: 'inventario',
    title: 'Gestor de Inventarios',
    description: 'Controla el stock de tus ingredientes en tiempo real, con alertas automáticas de insumos por agotarse.',
    price: '+$30.00/mes',
    icon: <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>,
    iconBg: 'bg-orange-100',
    features: [
      'Control de stock en tiempo real',
      'Alertas automáticas de insumos por agotarse',
      'Registro de entradas y salidas',
      'Reportes de costos y márgenes',
      'Integración con tu carta digital',
    ],
    preview: {
      title: 'Vista previa del módulo',
      description: 'Mantén el control total de tus ingredientes. El sistema automáticamente descuenta el stock cuando se registra una venta y te alerta cuando un insumo está por agotarse.',
      steps: ['Registra tus ingredientes y stock inicial', 'El sistema descuenta automáticamente', 'Recibe alertas de stock bajo', 'Genera reportes de costos'],
    },
  },
  {
    id: 'trabajadores',
    title: 'Gestor de Trabajadores',
    description: 'Administra horarios, turnos, propinas y desempeño de tu equipo de mozos y personal de cocina.',
    price: '+$25.00/mes',
    icon: <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>,
    iconBg: 'bg-rose-100',
    features: [
      'Gestión de horarios y turnos',
      'Control de propinas por empleado',
      'Reportes de desempeño',
      'Calculadora de nómina',
      'Calendario de ausencias',
    ],
    preview: {
      title: 'Vista previa del módulo',
      description: 'Administra todo tu equipo desde un solo lugar. Controla horarios, registra propinas y genera reportes de desempeño para optimizar las operaciones de tu restaurante.',
      steps: ['Registra a tus empleados', 'Asigna horarios y turnos', 'Las propinas se registran automáticamente', 'Genera reportes de desempeño'],
    },
  }
];

export default function ModulesView({
  activeModules,
  onActivateModule,
  activePlan,
  onRequestUpgrade,
  onCreateProposal,
}) {
  const [selectedModule, setSelectedModule] = useState(null)
  const [detailModule, setDetailModule] = useState(null)
  const [authStep, setAuthStep] = useState(1)

  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false)
  const [proposalForm, setProposalForm] = useState({ title: '', description: '', value: '' })

  const submitProposal = () => {
    if (!proposalForm.title || !proposalForm.description) {
      alert("Por favor completa el título y la descripción de tu idea.")
      return
    }
    onCreateProposal(proposalForm)
    setIsProposalModalOpen(false)
    setProposalForm({ title: '', description: '', value: '' })
  }

  if (activePlan === 'basico') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 animate-[fadeIn_0.4s_ease-out]">
        <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-inner border border-indigo-100">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
        </div>
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 tracking-tight">Desbloquea los Módulos Premium</h2>
        <p className="text-slate-600 max-w-lg mx-auto mb-10 text-lg leading-relaxed">
          El catálogo de módulos (Reservas, WhatsApp, Inventarios) es una característica exclusiva del <strong className="text-indigo-600">Plan Profesional</strong>. Escala las operaciones de tu restaurante cambiando de plan hoy mismo.
        </p>
        <button onClick={onRequestUpgrade} className="px-8 py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex items-center gap-2">
          <span>Mejorar al Plan Profesional</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
        </button>
      </div>
    )
  }

  return (
    <>
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Catálogo de Módulos</h2>
        <p className="text-slate-500">Potencia tu web con nuevas herramientas para escalar tu restaurante.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {modulesCatalog.map((mod) => (
          <div key={mod.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 ${mod.iconBg} rounded-xl flex items-center justify-center`}>
                  {mod.icon}
                </div>
                <h3 className="font-bold text-slate-900 leading-tight">{mod.title}</h3>
              </div>
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">{mod.description}</p>
              <button
                onClick={() => setDetailModule(mod)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline decoration-indigo-600/30 hover:decoration-indigo-600 underline-offset-4 mb-4"
              >
                Ver detalles y vista previa
              </button>
            </div>
            <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
              <span className="font-bold text-slate-900">{mod.price}</span>
              {activeModules.includes(mod.id) ? (
                <button disabled className="px-4 py-2 bg-slate-100 text-slate-500 text-sm font-medium rounded-lg flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Activo
                </button>
              ) : (
                <button
                  onClick={() => setSelectedModule(mod)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  Solicitar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Banner */}
      <div className="mt-8 bg-slate-900 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"></div>
        <div className="relative z-10 text-center md:text-left">
          <h3 className="text-2xl font-bold text-white mb-2">¿Necesitas una funcionalidad a medida?</h3>
          <p className="text-slate-400 max-w-2xl">Si tienes una idea específica para tu restaurante que no está en nuestro catálogo (ej. integración con tu sistema de facturación local, reportes especiales), cuéntanosla.</p>
        </div>
        <button onClick={() => setIsProposalModalOpen(true)} className="relative z-10 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] shrink-0 w-full md:w-auto">
          Redactar propuesta
        </button>
      </div>
      </div>

      {/* Detail/Preview Modal */}
      {detailModule && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]" onClick={() => setDetailModule(null)}>
          <div className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden animate-[scaleUp_0.2s_ease-out] flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${detailModule.iconBg} rounded-xl flex items-center justify-center`}>
                  {detailModule.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900">{detailModule.title}</h3>
              </div>
              <button onClick={() => setDetailModule(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto no-scrollbar space-y-6">
              {/* Description */}
              <div>
                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Descripción</h4>
                <p className="text-slate-700 leading-relaxed">{detailModule.preview.description}</p>
              </div>

              {/* How it works */}
              <div>
                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Cómo funciona</h4>
                <div className="space-y-3">
                  {detailModule.preview.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 text-xs font-bold">
                        {i + 1}
                      </div>
                      <p className="text-sm text-slate-700 pt-0.5">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Features */}
              <div>
                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Características incluidas</h4>
                <ul className="space-y-2">
                  {detailModule.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
              <span className="text-lg font-bold text-slate-900">{detailModule.price}</span>
              <div className="flex gap-3">
                <button onClick={() => setDetailModule(null)} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cerrar</button>
                {activeModules.includes(detailModule.id) ? (
                  <button disabled className="px-5 py-2.5 text-sm font-medium bg-slate-100 text-slate-500 rounded-lg cursor-not-allowed flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Ya está activo
                  </button>
                ) : (
                  <button onClick={() => { setDetailModule(null); setSelectedModule(detailModule); }} className="px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm transition-colors">
                    Solicitar este módulo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2FA Purchase Modal */}
      {selectedModule && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]" onClick={() => { setSelectedModule(null); setAuthStep(1); }}>
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl overflow-hidden animate-[scaleUp_0.2s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                Autorizar Compra
              </h3>
              <button onClick={() => { setSelectedModule(null); setAuthStep(1); }} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-6">
              <div className="bg-indigo-50 border border-indigo-100 text-indigo-800 text-sm p-4 rounded-xl mb-6">
                Estás a punto de activar <strong>{selectedModule.title}</strong> por {selectedModule.price}. Se añadirá a tu próximo ciclo de facturación.
              </div>
              <div className="space-y-4">
                {authStep === 1 ? (
                  <div className="animate-[fadeIn_0.3s_ease-out]">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Contraseña de administrador</label>
                    <input type="password" placeholder="Ingresa tu contraseña" className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" />
                  </div>
                ) : (
                  <div className="animate-[fadeIn_0.3s_ease-out]">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Código de verificación</label>
                    <p className="text-xs text-slate-500 mb-3">Te enviamos un código de 6 dígitos al correo.</p>
                    <input type="text" placeholder="0 0 0 0 0 0" maxLength="6" className="w-full px-4 py-3 rounded-lg border border-slate-300 text-center tracking-[0.5em] font-mono text-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" />
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => { setSelectedModule(null); setAuthStep(1); }} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg">Cancelar</button>
              {authStep === 1 ? (
                <button onClick={() => setAuthStep(2)} className="px-5 py-2.5 text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 rounded-lg shadow-sm">Verificar contraseña</button>
              ) : (
                <button onClick={() => { onActivateModule(selectedModule); setSelectedModule(null); setAuthStep(1); }} className="px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm">Confirmar y Activar</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Proposal Modal */}
      {isProposalModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]" onClick={() => setIsProposalModalOpen(false)}>
          <div className="bg-white max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden animate-[scaleUp_0.2s_ease-out] flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                Nueva funcionalidad a medida
              </h3>
              <button onClick={() => setIsProposalModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto no-scrollbar space-y-5">
              <div className="bg-indigo-50 text-indigo-800 text-sm p-4 rounded-xl">
                Comparte tu idea con nuestro equipo de desarrollo. Analizaremos la viabilidad técnica y te enviaremos una cotización y tiempos de entrega mediante un ticket de soporte.
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Título de tu idea</label>
                <input type="text" value={proposalForm.title} onChange={(e) => setProposalForm({...proposalForm, title: e.target.value})} placeholder="Ej. Integración con impresora de cocina Bluetooth" className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Descripción de la funcionalidad</label>
                <textarea value={proposalForm.description} onChange={(e) => setProposalForm({...proposalForm, description: e.target.value})} rows="3" placeholder="Explica detalladamente cómo te gustaría que funcione..." className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none"></textarea>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">¿Qué problema resuelve en tu local? <span className="text-slate-400 font-normal">(Opcional)</span></label>
                <textarea value={proposalForm.value} onChange={(e) => setProposalForm({...proposalForm, value: e.target.value})} rows="2" placeholder="Ej. Evitaría que los mozos caminen hasta la cocina..." className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none"></textarea>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsProposalModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
              <button onClick={submitProposal} className="px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors shadow-sm">Enviar Propuesta</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
