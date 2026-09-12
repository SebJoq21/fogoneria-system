import React, { useState } from 'react';

function FinanceCard() {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
      <p className="text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wider">Deuda actual</p>
      <p className="text-4xl font-extrabold text-slate-900 mb-2">$0.00</p>
      <span className="inline-flex w-max items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-md border border-emerald-100">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
        Todo al día
      </span>
    </div>
  );
}

function NextPaymentCard() {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full">
      <div className="flex justify-between items-start mb-2">
        <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
          Próximo pago
        </span>
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-1">
        1 de Noviembre, 2026
      </h3>
      <p className="text-3xl font-black text-slate-900 mb-6">$70.00</p>
      <div className="mt-auto">
        <button type="button" disabled className="w-full bg-slate-100 text-slate-400 font-medium py-2.5 rounded-xl cursor-not-allowed border border-slate-200">
          Pagar ahora
        </button>
      </div>
    </div>
  );
}

export default function PaymentsView({ paymentHistory, domainName }) {
  const [selectedDay, setSelectedDay] = useState(null);

  // Configuración dinámica del mes actual
  const today = new Date();
  const currentMonthName = today.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  // Poner la primera letra en mayúscula: "Agosto 2026"
  const formattedMonth = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);

  const daysInMonth = Array.from({ length: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() }, (_, i) => i + 1);
  const weekDays = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

  // Determinar qué día de la semana empieza el mes para dejar espacios vacíos
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const emptyStartDays = Array.from({ length: firstDayOfMonth });

  const displayedHistory = selectedDay
    ? paymentHistory.filter(p => p.day === selectedDay)
    : paymentHistory;

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      {/* Domain indicator */}
      {domainName && (
        <div className="mb-6 flex items-center gap-2 text-sm text-slate-500">
          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
          Pagos de <span className="font-semibold text-slate-700">{domainName}</span>
        </div>
      )}

      {/* Tarjetas Superiores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <FinanceCard />
        <NextPaymentCard />
      </div>

      {/* Sección Inferior: Calendario + Historial */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* COLUMNA IZQUIERDA: Calendario */}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-max">
          <div className="flex justify-between items-center mb-6">
            <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            </button>
            <h3 className="font-bold text-slate-900">{formattedMonth}</h3>
            <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-xs font-semibold text-slate-400 py-1">{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-sm">
            {emptyStartDays.map((_, i) => (
              <div key={`empty-${i}`} className="p-2"></div>
            ))}
            {daysInMonth.map(day => {
              const dayEvents = paymentHistory.filter(p => p.day === day);
              const isSelected = selectedDay === day;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`relative p-2 flex flex-col items-center justify-center rounded-lg transition-all ${
                    isSelected ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span className="font-medium z-10">{day}</span>
                  {dayEvents.length > 0 && (
                    <div className="absolute bottom-1 flex gap-0.5">
                      {dayEvents.map(ev => (
                        <span key={ev.id} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : ev.type === 'plan' ? 'bg-emerald-500' : 'bg-indigo-500'}`}></span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Leyenda del calendario */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Pagos de suscripción
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Compra de módulos
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: Tabla de Historial */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h2 className="font-bold text-slate-900">
              {selectedDay ? `Movimientos del ${selectedDay} de ${formattedMonth.split(' ')[0]}` : 'Historial de Movimientos'}
            </h2>
            {selectedDay && (
              <button onClick={() => setSelectedDay(null)} className="text-xs text-indigo-600 font-medium hover:underline">
                Ver todos
              </button>
            )}
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-slate-400 border-b border-slate-100 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Fecha</th>
                  <th className="px-6 py-4 font-semibold">Concepto</th>
                  <th className="px-6 py-4 font-semibold">Monto</th>
                  <th className="px-6 py-4 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {displayedHistory.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                      No hay movimientos registrados en esta fecha.
                    </td>
                  </tr>
                ) : (
                  displayedHistory.map((payment) => (
                    <tr key={payment.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{payment.date}</td>
                      <td className="px-6 py-4 text-slate-700 font-medium">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${payment.type === 'plan' ? 'bg-emerald-500' : 'bg-indigo-500'}`}></span>
                          {payment.concept}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-900 font-bold whitespace-nowrap">
                        {payment.amount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 w-max">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                          {payment.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}