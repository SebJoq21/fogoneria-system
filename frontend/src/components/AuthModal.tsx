import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Eye, EyeOff, ArrowRight, Globe } from 'lucide-react'

const AUTH_STORAGE_KEY = 'aw_auth_form_data'

function AuthModal({ mode, onClose, onToggle, onSubmit }) {
  const isLogin = mode === 'login'
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordsMatch, setPasswordsMatch] = useState(true)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLogin) {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY)
      if (saved) {
        try {
          const data = JSON.parse(saved)
          setFullName(data.fullName || '')
          setEmail(data.email || '')
          setPhone(data.phone || '')
          setPassword(data.password || '')
          setConfirmPassword(data.confirmPassword || '')
          setAcceptedTerms(data.acceptedTerms || false)
          localStorage.removeItem(AUTH_STORAGE_KEY)
        } catch {}
      }
    }
  }, [isLogin])

  const saveFormToStorage = () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      fullName, email, phone, password, confirmPassword, acceptedTerms
    }))
  }

  const handlePasswordChange = (e) => {
    setPassword(e.target.value)
    if (confirmPassword) {
      setPasswordsMatch(e.target.value === confirmPassword)
    }
  }

  const handleConfirmPasswordChange = (e) => {
    setConfirmPassword(e.target.value)
    setPasswordsMatch(password === e.target.value)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!isLogin && !passwordsMatch) return
    if (isLogin) {
      onClose()
      navigate('/dashboard')
      return
    }
    if (onSubmit) onSubmit()
  }

  const handleTermsClick = (e) => {
    e.preventDefault()
    saveFormToStorage()
    navigate('/terminos')
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F172A]/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-3xl shadow-2xl w-full relative animate-[scaleUp_0.25s_ease-out] overflow-hidden ${
          isLogin ? 'max-w-md mx-4' : 'max-w-lg mx-4 max-h-[90vh] overflow-y-auto'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with elegant gradient - landing purple */}
        <div className="relative h-36 bg-gradient-to-br from-[#7C3AED] via-[#6D28D9] to-[#5B21B6] flex items-center justify-center">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.15\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
          <div className="relative text-center">
            <div className="w-14 h-14 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20">
              <Globe className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white font-heading">
              {isLogin ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
            </h2>
            <p className="text-purple-200 text-sm mt-1">
              {isLogin ? 'Inicia sesión para gestionar tu web' : 'Regístrate para empezar'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full p-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-8 py-8">
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 mb-6">
              {!isLogin && (
                <div>
                  <label className="text-sm font-medium text-slate-600 mb-1.5 block">Nombre y apellidos</label>
                  <input
                    type="text"
                    placeholder="Juan Pérez"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent text-slate-900 bg-slate-50 hover:bg-white transition-colors text-sm"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-600 mb-1.5 block">Correo Electrónico</label>
                <input
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent text-slate-900 bg-slate-50 hover:bg-white transition-colors text-sm"
                />
              </div>

              {!isLogin && (
                <div>
                  <label className="text-sm font-medium text-slate-600 mb-1.5 block">Número de celular</label>
                  <input
                    type="tel"
                    placeholder="+51 987 654 321"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent text-slate-900 bg-slate-50 hover:bg-white transition-colors text-sm"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-600 mb-1.5 block">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={handlePasswordChange}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent text-slate-900 bg-slate-50 hover:bg-white transition-colors text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <div>
                  <label className="text-sm font-medium text-slate-600 mb-1.5 block">Confirmar contraseña</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={handleConfirmPasswordChange}
                      className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent text-slate-900 bg-slate-50 hover:bg-white transition-colors text-sm ${
                        !passwordsMatch ? 'border-red-400 focus:ring-red-400' : 'border-slate-200'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {!passwordsMatch && (
                    <p className="text-red-500 text-xs mt-1">Las contraseñas no coinciden</p>
                  )}
                </div>
              )}
            </div>

            {!isLogin && (
              <div className="flex items-start mb-6">
                <div className="flex items-center h-5">
                  <input
                    id="terms"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="w-4 h-4 text-[#7C3AED] bg-white border-slate-300 rounded focus:ring-[#7C3AED] cursor-pointer"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="terms" className="text-slate-600 cursor-pointer">
                    He leído y acepto los{' '}
                    <a
                      href="/terminos"
                      onClick={handleTermsClick}
                      className="text-[#7C3AED] hover:underline font-medium"
                    >
                      Términos y Condiciones
                    </a>{' '}
                    y la Política de Privacidad.
                  </label>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!isLogin && (!acceptedTerms || !passwordsMatch)}
              className={`w-full font-semibold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
                (isLogin || (acceptedTerms && passwordsMatch))
                  ? 'bg-[#7C3AED] text-white hover:bg-[#6D28D9] hover:shadow-lg'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-slate-400">o</span>
            </div>
          </div>

          {/* Toggle */}
          <p className="text-sm text-slate-600 text-center">
            {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
            <span
              onClick={() => onToggle(isLogin ? 'register' : 'login')}
              className="text-[#7C3AED] font-semibold cursor-pointer hover:underline"
            >
              {isLogin ? 'Regístrate gratis' : 'Inicia sesión'}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

export default AuthModal
