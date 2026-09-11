import { Fragment, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Layers } from 'lucide-react'
import DropZone from '../components/DropZone'

const basicSteps = ['Elige tu plan', 'Datos del Local', 'Tu Carta', 'Dominio', 'Pago y Activación']
const proSteps = ['Elige tu plan', 'Datos del Local', 'Tu Carta', 'Tu Página Web', 'Dominio', 'Pago y Activación']

function Stepper({ current, steps }) {
  return (
    <div className="flex items-center w-full max-w-3xl mb-14 px-4 sm:px-10">
      {steps.map((step, index) => {
        const stepNumber = index + 1
        const isActive = current === stepNumber
        const isDone = current > stepNumber
        const circleClass =
          isDone || isActive
            ? 'bg-emerald-500 text-white'
            : 'bg-slate-200 text-slate-500'

        return (
          <Fragment key={step}>
            <div className="relative flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold z-10 shadow-sm transition-colors ${
                  isActive && !isDone ? 'bg-indigo-600' : circleClass
                }`}
              >
                {isDone ? <Check className="w-4 h-4" /> : stepNumber}
              </div>
              <span
                className={`absolute top-12 text-center text-xs font-semibold w-32 transition-colors ${
                  isActive || isDone ? 'text-indigo-600' : 'text-slate-700'
                }`}
              >
                {step}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 rounded transition-colors ${
                  current > index + 1 ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

function StepPlan({ selectedPlan, onSelectPlan }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">
        ¿Qué plan necesitas?
      </h2>
      <p className="text-slate-600 mb-6">
        Elige el plan que mejor se adapte a tu restaurante.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Plan Básico */}
        <div
          onClick={() => onSelectPlan('basico')}
          className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all ${
            selectedPlan === 'basico'
              ? 'border-indigo-600 bg-indigo-50/10'
              : 'border-slate-200 hover:border-indigo-300'
          }`}
        >
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-bold text-slate-900">Plan Básico</h4>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selectedPlan === 'basico' ? 'border-indigo-600' : 'border-slate-300'
              }`}
            >
              {selectedPlan === 'basico' && (
                <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>
              )}
            </div>
          </div>
          <div className="mb-3">
            <span className="text-2xl font-black text-slate-900">$30</span>
            <span className="text-sm text-slate-500">/mes</span>
          </div>
          <p className="text-sm text-slate-600">
            Carta digital QR con sitio web de 1 página. Ideal para locales pequeños.
          </p>
        </div>

        {/* Plan Profesional */}
        <div
          onClick={() => onSelectPlan('profesional')}
          className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all ${
            selectedPlan === 'profesional'
              ? 'border-indigo-600 bg-indigo-50/10'
              : 'border-slate-200 hover:border-indigo-300'
          }`}
        >
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-bold text-slate-900">Plan Profesional</h4>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selectedPlan === 'profesional' ? 'border-indigo-600' : 'border-slate-300'
              }`}
            >
              {selectedPlan === 'profesional' && (
                <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>
              )}
            </div>
          </div>
          <div className="mb-3">
            <span className="text-2xl font-black text-slate-900">$65</span>
            <span className="text-sm text-slate-500">/mes</span>
          </div>
          <p className="text-sm text-slate-600">
            Landing page completa, dominio propio, reservas online y gestión por nuestro equipo.
          </p>
        </div>
      </div>
    </div>
  )
}

function StepBusinessInfo() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-4">
        Datos de tu restaurante
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-slate-700 mb-1 block">
            Nombre comercial del restaurante
          </label>
          <input
            type="text"
            placeholder="Ej. La Cevichería del Puerto"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-900 bg-slate-50 hover:bg-white transition-colors"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 block">
            RUC / NIT
          </label>
          <input
            type="text"
            placeholder="20123456789"
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-900 bg-slate-50 hover:bg-white transition-colors"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 block">
            Teléfono / WhatsApp
          </label>
          <input
            type="tel"
            placeholder="+51 987 654 321"
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-900 bg-slate-50 hover:bg-white transition-colors"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-slate-700 mb-1 block">
            Dirección del local
          </label>
          <input
            type="text"
            placeholder="Av. Principal 123, Lima"
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-900 bg-slate-50 hover:bg-white transition-colors"
          />
        </div>
      </div>
    </div>
  )
}

function StepMenu() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">
        Tu carta digital
      </h2>
      <p className="text-slate-600 mb-4">
        Sube tu carta en formato PDF o fotos claras de tus menús.
      </p>
      <DropZone type="document" text="Haz clic o arrastra tu carta aquí" />

      <div className="mt-6">
        <label className="text-sm font-medium text-slate-700 mb-1 block">
          Describe cómo quieres tu carta
        </label>
        <textarea
          rows={3}
          placeholder="Ej. Quiero una carta elegante con colores oscuros, estilo moderno, fotos de cada plato..."
          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-900 bg-slate-50 hover:bg-white transition-colors resize-none"
        />
      </div>

      <div className="mt-4">
        <label className="text-sm font-medium text-slate-700 mb-1 block">
          Sube fotos de tus platos más representativos
        </label>
        <DropZone type="images" text="Haz clic o arrastra tus imágenes aquí" />
      </div>
    </div>
  )
}

function StepWebsite() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">
        Tu página web profesional
      </h2>
      <p className="text-slate-600 mb-4">
        Cuéntanos sobre tu restaurante para crear una web única.
      </p>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 block">
            Estilo visual que deseas
          </label>
          <select className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-900 bg-slate-50 hover:bg-white transition-colors">
            <option value="">Selecciona un estilo</option>
            <option value="moderno">Moderno y minimalista</option>
            <option value="elegante">Elegante y sofisticado</option>
            <option value="tradicional">Tradicional y cálido</option>
            <option value="colorido">Colorido y vibrante</option>
            <option value="rustico">Rústico y artesanal</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 block">
            Historia o Quiénes Somos
          </label>
          <textarea
            rows={3}
            placeholder="Cuéntanos la historia de tu restaurante, tu equipo y tradiciones..."
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-900 bg-slate-50 hover:bg-white transition-colors resize-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 block">
            Sube fotos de tu local y equipo
          </label>
          <DropZone type="images" text="Haz clic o arrastra tus imágenes aquí" />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 block">
            Fotos de comidas representativas
          </label>
          <DropZone type="images" text="Haz clic o arrastra tus imágenes aquí" />
        </div>
      </div>
    </div>
  )
}

function StepDomain({ domainType, setDomainType, selectedPlan }) {
  const isBasico = selectedPlan === 'basico'
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">
        {isBasico ? 'Elige tu subdominio' : 'Elige tu dominio'}
      </h2>
      <p className="text-slate-600 mb-6">
        {isBasico
          ? 'Tu sitio estará disponible en un subdominio gratuito de AlquilaWeb.'
          : 'Ingresa el dominio que deseas para tu restaurante. Nosotros nos encargamos de configurarlo y crearlo por ti.'}
      </p>

      <div className="space-y-4">
        {isBasico && (
          <div className="p-4 rounded-xl border-2 border-indigo-600 bg-indigo-50/10">
            <div className="font-semibold text-slate-900 mb-1">Subdominio gratuito incluido</div>
            <div className="text-xs text-slate-500">Con tu plan Básico, tu sitio estará en www.tunombre.alquilaweb.com</div>
          </div>
        )}

        {/* Domain input */}
        <div className="mt-4">
          <div className="flex items-center gap-0">
            <span className="text-slate-500 text-sm">www.</span>
            <input
              type="text"
              placeholder={isBasico ? 'tunombre' : 'tudominio'}
              className="flex-1 px-3 py-2.5 border border-slate-200 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-900 bg-slate-50 hover:bg-white transition-colors text-sm"
            />
            <span className="px-3 py-2.5 bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg text-sm text-slate-600">
              {isBasico ? '.alquilaweb.com' : '.com'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {isBasico
              ? 'Gratis con tu plan. Tu sitio estará disponible en este subdominio.'
              : 'No te preocupes si no tienes el dominio aún. Lo registraremos y configuraremos por ti.'}
          </p>
        </div>
      </div>
    </div>
  )
}

function StepPayment() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">
        Último paso: Activa tu web
      </h2>
      <p className="text-slate-600 mb-4">
        Sube la captura de pantalla de tu transferencia o pago por billetera
        digital para que nuestro equipo ensamble tu sitio inmediatamente.
      </p>
      <DropZone
        type="payment"
        text="Haz clic o arrastra tu comprobante aquí"
      />
    </div>
  )
}

function Onboarding() {
  const [step, setStep] = useState(1)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [domainType, setDomainType] = useState('subdomain')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isAddDomainMode = searchParams.get('mode') === 'addDomain'

  const steps = selectedPlan === 'profesional' ? proSteps : basicSteps

  const handleNext = () => {
    if (step === steps.length) {
      if (isAddDomainMode) {
        const newDomainId = `dom-${Date.now()}`
        const newDomain = {
          id: newDomainId,
          name: `nuevo-dominio-${Date.now()}.com`,
          plan: selectedPlan || 'basico',
          status: 'pending',
          activeModules: [],
          paymentHistory: [],
          metrics: null,
        }
        navigate('/dashboard', { state: { newDomain } })
        return
      }
      navigate('/dashboard')
      return
    }
    setStep((prev) => Math.min(prev + 1, steps.length))
  }
  const handleBack = () => setStep((prev) => Math.max(prev - 1, 1))

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-slate-50 py-6 px-4">
      {/* Volver al inicio */}
      <Link
        to="/"
        className="absolute top-6 left-6 sm:top-8 sm:left-8 flex items-center text-slate-500 hover:text-indigo-600 transition-colors text-sm font-medium"
      >
        <svg
          className="w-4 h-4 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        Volver al inicio
      </Link>

      {/* Header simplificado */}
      <Link
        to="/"
        className="mb-6 hover:opacity-80 transition-opacity cursor-pointer"
      >
        <span className="flex items-center gap-2 text-2xl font-black tracking-tighter text-slate-900">
          <Layers className="w-6 h-6 text-indigo-600" />
          AlquilaWeb
        </span>
      </Link>

      <div className="w-full max-w-2xl flex flex-col">
        {/* Stepper - only show after plan is selected */}
        {step > 1 && <Stepper current={step - 1} steps={steps.slice(1)} />}

        {/* Contenido del paso */}
        <div className="w-full bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200">
          {step === 1 && <StepPlan selectedPlan={selectedPlan} onSelectPlan={setSelectedPlan} />}
          {step === 2 && <StepBusinessInfo />}
          {step === 3 && <StepMenu />}
          {step === 4 && selectedPlan === 'profesional' && <StepWebsite />}
          {step === 4 && selectedPlan === 'basico' && <StepDomain domainType={domainType} setDomainType={setDomainType} selectedPlan={selectedPlan} />}
          {step === 5 && selectedPlan === 'profesional' && <StepDomain domainType={domainType} setDomainType={setDomainType} selectedPlan={selectedPlan} />}
          {step === 5 && selectedPlan === 'basico' && <StepPayment />}
          {step === 6 && <StepPayment />}

          <div className="flex items-center justify-between mt-6">
            {step === 1 ? (
              <Link
                to="/"
                className="text-slate-500 hover:text-slate-800 font-medium px-4 py-2 transition-colors"
              >
                Cancelar
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleBack}
                className="text-slate-500 hover:text-slate-800 font-medium px-4 py-2 transition-colors cursor-pointer"
              >
                ← Atrás
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={step === 1 && !selectedPlan}
              className={`font-medium px-6 py-2 rounded-lg transition-colors cursor-pointer ${
                step === 1 && !selectedPlan
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {step === steps.length ? 'Finalizar y Enviar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Onboarding
