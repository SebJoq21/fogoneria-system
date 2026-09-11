import React, { useState, useEffect } from 'react';

const defaultBusinessData = {
  tradeName: '',
  legalName: '',
  taxId: '',
  phone: '',
  address: ''
};

export default function SettingsView({ onNotify, domainId, domainName, accountName, setAccountName }) {
  const [businessData, setBusinessData] = useState(defaultBusinessData);
  const [isLoaded, setIsLoaded] = useState(false);
  const [localAccountName, setLocalAccountName] = useState(accountName || 'Mi Restaurante S.A.C.');
  const [showAccountSuccess, setShowAccountSuccess] = useState(false);

  const [securityData, setSecurityData] = useState({
    email: 'admin@mirestaurante.com',
    currentPassword: '',
    newPassword: ''
  });

  const [securityStep, setSecurityStep] = useState(1);

  // Load domain-specific data when domain changes
  useEffect(() => {
    // In a real app, this would fetch from an API
    // For now, we use mock data per domain
    const mockData = {
      'dom-1': {
        tradeName: 'Mi Restaurante S.A.C.',
        legalName: 'MI RESTAURANTE SOCIEDAD ANONIMA CERRADA',
        taxId: '20123456789',
        phone: '+51 987 654 321',
        address: 'Av. Principal 123, Lima'
      },
      'dom-2': {
        tradeName: 'Café Lima E.I.R.L.',
        legalName: 'CAFÉ LIMA EMPRESA INDIVIDUAL DE RESPONSABILIDAD LIMITADA',
        taxId: '20987654321',
        phone: '+51 912 345 678',
        address: 'Av. Larco 456, Miraflores'
      }
    };
    setBusinessData(mockData[domainId] || defaultBusinessData);
    setIsLoaded(true);
  }, [domainId]);

  const handleSaveBusiness = (e) => {
    e.preventDefault();
    onNotify('Datos actualizados', `La información de ${domainName || 'tu restaurante'} se ha guardado correctamente.`);
  };

  const handleRequestSecurityUpdate = (e) => {
    e.preventDefault();
    if (securityData.newPassword && !securityData.currentPassword) {
      alert("Debes ingresar tu contraseña actual para cambiarla.");
      return;
    }
    setSecurityStep(2);
  };

  const handleConfirmSecurityUpdate = (e) => {
    e.preventDefault();
    onNotify('Seguridad actualizada', 'Tus credenciales de acceso han sido modificadas exitosamente.');
    setSecurityData({ ...securityData, currentPassword: '', newPassword: '' });
    setSecurityStep(1);
  };

  if (!isLoaded) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-[fadeIn_0.3s_ease-out]">

      {/* Domain indicator */}
      {domainName && (
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
          Configuración de <span className="font-semibold text-slate-700">{domainName}</span>
        </div>
      )}

      {/* TARJETA 0: Nombre de la Cuenta */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
          <div className="w-8 h-8 rounded-full bg-[#1E293B] text-white flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Nombre de la Cuenta</h2>
            <p className="text-xs text-slate-500">Aparece en la esquina superior derecha del dashboard</p>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setAccountName(localAccountName); setShowAccountSuccess(true); setTimeout(() => setShowAccountSuccess(false), 2500); onNotify('Cuenta actualizada', 'El nombre de tu cuenta se ha guardado correctamente.'); }} className="p-6">
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-md">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre visible en el dashboard</label>
              <input
                type="text"
                value={localAccountName}
                onChange={(e) => setLocalAccountName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-[#1E293B] focus:ring-2 focus:ring-slate-200 outline-none transition-all"
              />
            </div>
            <button type="submit" className="px-5 py-2.5 bg-[#1E293B] text-white font-semibold rounded-xl hover:bg-[#334155] transition-colors shadow-sm whitespace-nowrap">
              Guardar Nombre
            </button>
          </div>
          {showAccountSuccess && (
            <p className="text-sm text-emerald-600 mt-2 font-medium animate-[fadeIn_0.2s_ease-out]">✓ Nombre actualizado</p>
          )}
        </form>
      </div>

      {/* TARJETA 1: Información del Local */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900">Información del Restaurante</h2>
        </div>

        <form onSubmit={handleSaveBusiness} className="p-6">
          <div className="flex flex-col sm:flex-row gap-6 mb-8 items-start">
            {/* Logo Upload */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="w-24 h-24 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:border-indigo-400 transition-colors cursor-pointer overflow-hidden">
                <span className="font-bold text-2xl">{businessData.tradeName ? businessData.tradeName.charAt(0) : 'MR'}</span>
              </div>
              <span className="text-xs text-indigo-600 font-medium cursor-pointer hover:underline">Cambiar logo</span>
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre Comercial</label>
                <input type="text" value={businessData.tradeName} onChange={e => setBusinessData({...businessData, tradeName: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Razón Social</label>
                <input type="text" value={businessData.legalName} onChange={e => setBusinessData({...businessData, legalName: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">RUC / NIT</label>
                <input type="text" value={businessData.taxId} onChange={e => setBusinessData({...businessData, taxId: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Teléfono</label>
                <input type="text" value={businessData.phone} onChange={e => setBusinessData({...businessData, phone: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Dirección del Local</label>
                <input type="text" value={businessData.address} onChange={e => setBusinessData({...businessData, address: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
              Guardar Información
            </button>
          </div>
        </form>
      </div>

      {/* TARJETA 2: Seguridad y Acceso */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900">Seguridad y Acceso</h2>
        </div>

        <form onSubmit={securityStep === 1 ? handleRequestSecurityUpdate : handleConfirmSecurityUpdate} className="p-6">

          {securityStep === 1 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6 animate-[fadeIn_0.3s_ease-out]">
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Correo de Administración</label>
                <input type="email" value={securityData.email} onChange={e => setSecurityData({...securityData, email: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
                <p className="text-xs text-slate-500 mt-1">Este correo se usa para facturación y recuperación de contraseña.</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Contraseña Actual</label>
                <input type="password" placeholder="••••••••" value={securityData.currentPassword} onChange={e => setSecurityData({...securityData, currentPassword: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nueva Contraseña</label>
                <input type="password" placeholder="Mínimo 8 caracteres" value={securityData.newPassword} onChange={e => setSecurityData({...securityData, newPassword: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
              </div>
            </div>
          ) : (
            <div className="mb-6 animate-[fadeIn_0.3s_ease-out] max-w-sm">
              <label className="block text-sm font-semibold text-slate-700 mb-1 flex justify-between">
                Código de verificación
                <span className="text-xs text-indigo-600 cursor-pointer hover:underline">Reenviar código</span>
              </label>
              <p className="text-xs text-slate-500 mb-3">Te hemos enviado un código de 6 dígitos al correo <strong>{securityData.email}</strong>.</p>
              <input
                type="text"
                placeholder="0 0 0 0 0 0"
                maxLength="6"
                required
                className="w-full px-4 py-3 rounded-lg border border-slate-300 text-center tracking-[0.5em] font-mono text-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-100 gap-3">
            {securityStep === 2 && (
              <button
                type="button"
                onClick={() => setSecurityStep(1)}
                className="px-6 py-2.5 bg-slate-100 text-slate-600 font-semibold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
            )}
            <button type="submit" className="px-6 py-2.5 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors shadow-sm">
              {securityStep === 1 ? 'Actualizar Seguridad' : 'Verificar y Guardar'}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
